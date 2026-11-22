package tj.dukhtarikhubam.app;

import android.content.Intent;
import android.net.Uri;

import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Premium through Google Play (Billing Library): the subscription's prices as Google gives them for her
 * country, the purchase itself, and the purchases she already has. The purchase is only reported here; the
 * server checks it with Google and gives Premium (it also acknowledges it), never the phone.
 */
@CapacitorPlugin(name = "PlayBilling")
public class PlayBilling extends Plugin implements PurchasesUpdatedListener {

    private BillingClient client;
    /** the product details last read, by product id (a purchase needs them) */
    private final Map<String, ProductDetails> details = new HashMap<>();
    /** the purchase being made: answered when Google Play reports it */
    private PluginCall buying;

    @Override
    public void load() {
        client = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
            .enableAutoServiceReconnection()
            .build();
    }

    /** runs `then` once connected to Google Play; answers `call` with an error when it cannot connect */
    private void ready(PluginCall call, Runnable then) {
        if (client.isReady()) { then.run(); return; }
        client.startConnection(new BillingClientStateListener() {
            @Override public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) then.run();
                else call.reject("Google Play is not available: " + r.getDebugMessage(), String.valueOf(r.getResponseCode()));
            }
            @Override public void onBillingServiceDisconnected() { /* reconnected by the library on the next call */ }
        });
    }

    /** The subscriptions (ids) with their offers and price phases, as Google Play shows them in her country. */
    @PluginMethod
    public void products(PluginCall call) {
        JSArray ids = call.getArray("ids", new JSArray());
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        try {
            for (int i = 0; i < ids.length(); i++) {
                list.add(QueryProductDetailsParams.Product.newBuilder().setProductId(ids.getString(i)).setProductType(BillingClient.ProductType.SUBS).build());
            }
        } catch (Exception e) { call.reject("bad ids"); return; }
        if (list.isEmpty()) { call.reject("no ids"); return; }
        ready(call, () -> client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(list).build(), (r, result) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                call.reject(r.getDebugMessage(), String.valueOf(r.getResponseCode()));
                return;
            }
            JSArray out = new JSArray();
            for (ProductDetails p : result.getProductDetailsList()) {
                details.put(p.getProductId(), p);
                JSObject product = new JSObject();
                product.put("id", p.getProductId());
                product.put("title", p.getName());
                JSArray offers = new JSArray();
                List<ProductDetails.SubscriptionOfferDetails> subs = p.getSubscriptionOfferDetails();
                if (subs != null) for (ProductDetails.SubscriptionOfferDetails o : subs) {
                    JSObject offer = new JSObject();
                    offer.put("token", o.getOfferToken());
                    offer.put("basePlanId", o.getBasePlanId());
                    offer.put("offerId", o.getOfferId());
                    offer.put("tags", new JSONArray(o.getOfferTags()));
                    JSArray phases = new JSArray();
                    for (ProductDetails.PricingPhase ph : o.getPricingPhases().getPricingPhaseList()) {
                        JSObject phase = new JSObject();
                        phase.put("price", ph.getFormattedPrice());
                        phase.put("micros", ph.getPriceAmountMicros());
                        phase.put("currency", ph.getPriceCurrencyCode());
                        phase.put("period", ph.getBillingPeriod());
                        phase.put("cycles", ph.getBillingCycleCount());
                        phases.put(phase);
                    }
                    offer.put("phases", phases);
                    offers.put(offer);
                }
                product.put("offers", offers);
                out.put(product);
            }
            JSObject res = new JSObject();
            res.put("products", out);
            call.resolve(res);
        }));
    }

    /**
     * Buys a subscription offer (its token from products()), bound to her account (`accountId`, a hash of
     * it): resolves with { status: purchased | pending | cancelled | error, token? } when Google Play is done.
     */
    @PluginMethod
    public void buy(PluginCall call) {
        String productId = call.getString("productId");
        String offerToken = call.getString("offerToken");
        String accountId = call.getString("accountId");
        ProductDetails p = productId == null ? null : details.get(productId);
        if (p == null || offerToken == null) { call.reject("products() first"); return; }
        if (buying != null) { call.reject("a purchase is already open"); return; }
        ready(call, () -> getActivity().runOnUiThread(() -> {
            BillingFlowParams.Builder params = BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(Collections.singletonList(
                    BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(p).setOfferToken(offerToken).build()));
            if (accountId != null) params.setObfuscatedAccountId(accountId);
            call.setKeepAlive(true);
            buying = call;
            BillingResult r = client.launchBillingFlow(getActivity(), params.build());
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) finish(r.getResponseCode() == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED ? "owned" : "error", null, r);
        }));
    }

    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.OK && purchases != null && !purchases.isEmpty()) {
            Purchase p = purchases.get(0);
            finish(p.getPurchaseState() == Purchase.PurchaseState.PURCHASED ? "purchased" : "pending", p.getPurchaseToken(), r);
        } else if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            finish("cancelled", null, r);
        } else if (code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED) {
            finish("owned", null, r);
        } else {
            finish("error", null, r);
        }
        // a purchase that ends while the app was not waiting (a pending one paid later) is told to the app
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED && !p.isAcknowledged()) {
                    JSObject ev = new JSObject();
                    ev.put("token", p.getPurchaseToken());
                    notifyListeners("purchased", ev);
                }
            }
        }
    }

    private void finish(String status, String token, BillingResult r) {
        PluginCall call = buying;
        buying = null;
        if (call == null) return;
        JSObject res = new JSObject();
        res.put("status", status);
        if (token != null) res.put("token", token);
        res.put("code", r.getResponseCode());
        call.resolve(res);
        call.setKeepAlive(false);
    }

    /** The subscriptions she has on this Google account (to restore Premium, or send a purchase not yet sent). */
    @PluginMethod
    public void owned(PluginCall call) {
        ready(call, () -> client.queryPurchasesAsync(QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build(), (r, list) -> {
            if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) { call.reject(r.getDebugMessage(), String.valueOf(r.getResponseCode())); return; }
            JSArray out = new JSArray();
            for (Purchase p : list) {
                JSObject o = new JSObject();
                o.put("token", p.getPurchaseToken());
                o.put("products", new JSONArray(p.getProducts()));
                o.put("purchased", p.getPurchaseState() == Purchase.PurchaseState.PURCHASED);
                o.put("acknowledged", p.isAcknowledged());
                o.put("autoRenewing", p.isAutoRenewing());
                out.put(o);
            }
            JSObject res = new JSObject();
            res.put("purchases", out);
            call.resolve(res);
        }));
    }

    /** Opens her subscriptions in Google Play (to cancel or change the card). */
    @PluginMethod
    public void manage(PluginCall call) {
        String productId = call.getString("productId", "");
        String url = "https://play.google.com/store/account/subscriptions?package=" + getContext().getPackageName()
            + (productId.isEmpty() ? "" : "&sku=" + Uri.encode(productId));
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }
}
