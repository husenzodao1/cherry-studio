package app.coefmonitor.calc

import app.coefmonitor.calc.calculator.CalculationInput
import app.coefmonitor.calc.calculator.MartingaleCalculator
import app.coefmonitor.calc.export.DocxWriter
import app.coefmonitor.calc.export.ReportFormatter
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream
import java.math.BigDecimal
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element

/** TEST 10 (DOCX half): the document must carry exactly the values the screen shows. */
class DocxWriterTest {

    private val report = MartingaleCalculator.calculate(
        CalculationInput(BigDecimal("3.50"), BigDecimal("5000"), BigDecimal("1.00")),
    )

    private fun parts(bytes: ByteArray): Map<String, ByteArray> {
        val map = LinkedHashMap<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                map[entry.name] = zip.readBytes()
            }
        }
        return map
    }

    private fun document(bytes: ByteArray) = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
        .newDocumentBuilder().parse(ByteArrayInputStream(parts(bytes).getValue("word/document.xml")))

    @Test
    fun `package contains every required OOXML part`() {
        val names = parts(DocxWriter.write(report)).keys
        listOf(
            "[Content_Types].xml",
            "_rels/.rels",
            "word/document.xml",
            "word/styles.xml",
            "word/footer1.xml",
            "word/_rels/document.xml.rels",
        ).forEach { assertTrue("missing $it", it in names) }
    }

    @Test
    fun `all XML parts are well formed`() {
        parts(DocxWriter.write(report)).forEach { (name, data) ->
            DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
                .newDocumentBuilder().parse(ByteArrayInputStream(data))
            assertTrue("$name is empty", data.isNotEmpty())
        }
    }

    @Test
    fun `progression table has a header row and one row per round with the exact on-screen values`() {
        val doc = document(DocxWriter.write(report))
        val tables = doc.getElementsByTagNameNS(W, "tbl")
        assertEquals(2, tables.length)
        val rows = (tables.item(1) as Element).getElementsByTagNameNS(W, "tr")
        assertEquals(report.rows.size + 1, rows.length)

        val header = rows.item(0) as Element
        assertEquals(1, header.getElementsByTagNameNS(W, "tblHeader").length)
        assertEquals(ReportFormatter.TABLE_HEADERS, cellTexts(header))

        report.rows.forEachIndexed { index, row ->
            assertEquals(ReportFormatter.rowCells(row), cellTexts(rows.item(index + 1) as Element))
        }
    }

    @Test
    fun `main table column widths fill the text width exactly`() {
        val doc = document(DocxWriter.write(report))
        val table = doc.getElementsByTagNameNS(W, "tbl").item(1) as Element
        val widths = table.getElementsByTagNameNS(W, "gridCol").let { list ->
            (0 until list.length).sumOf { (list.item(it) as Element).getAttributeNS(W, "w").toInt() }
        }
        assertEquals(9638, widths)
    }

    @Test
    fun `summary figures are present in the document`() {
        val text = String(parts(DocxWriter.write(report)).getValue("word/document.xml"), Charsets.UTF_8)
        ReportFormatter.summary(report).forEach { item ->
            assertTrue("missing ${item.label}", text.contains(item.value.replace("&", "&amp;")))
        }
        assertTrue(text.contains("Martingale Strategy — 3.50x | Lucky Jet"))
    }

    private fun cellTexts(row: Element): List<String> {
        val cells = row.getElementsByTagNameNS(W, "tc")
        return (0 until cells.length).map { (cells.item(it) as Element).textContent }
    }

    companion object {
        private const val W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    }
}
