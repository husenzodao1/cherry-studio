package app.coefmonitor.calc.export

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import app.coefmonitor.calc.calculator.MartingaleReport
import app.coefmonitor.calc.calculator.RoundStatus
import java.io.ByteArrayOutputStream

private typealias PdfOp = (Canvas) -> Unit

/**
 * Renders the report to an A4 PDF with the platform [PdfDocument] (no third-party library).
 * Every cell text comes from [ReportFormatter], the same source as the on-screen table and the DOCX.
 */
object PdfWriter {
    private const val PAGE_W = 595 // A4 width in points
    private const val PAGE_H = 842 // A4 height in points
    private const val MARGIN = 40f
    private const val TEXT_WIDTH = 515f // PAGE_W - 2 * MARGIN

    private val NAVY = 0xFF1F3A5F.toInt()
    private val INK = 0xFF1C1F26.toInt()
    private val MUTED = 0xFF5B6472.toInt()
    private val BORDER = 0xFFC9CED6.toInt()
    private val ALT_ROW = 0xFFF4F6F9.toInt()
    private val MAX_ROW = 0xFFDCE7F5.toInt()
    private val STOP_ROW = 0xFFF8E1DE.toInt()

    private const val ROW_H = 18f
    private const val HEADER_H = 22f
    private const val FOOTER_Y = PAGE_H - 26f
    private const val BOTTOM_LIMIT = PAGE_H - 60f
    private const val CELL_PAD = 4f
    private const val CELL_TEXT = 9f
    private const val CELL_MIN_TEXT = 7f

    /** Column widths in points; they sum to TEXT_WIDTH. */
    private val COLUMN_WIDTHS = floatArrayOf(34f, 78f, 110f, 110f, 100f, 83f)
    private val ALIGNS = arrayOf(Align.CENTER, Align.RIGHT, Align.RIGHT, Align.RIGHT, Align.RIGHT, Align.CENTER)

    private enum class Align { LEFT, CENTER, RIGHT }

    fun write(report: MartingaleReport): ByteArray {
        check(COLUMN_WIDTHS.sum() == TEXT_WIDTH) { "Column widths must fill the text width" }
        val pages = Layout(report).build()
        val document = PdfDocument()
        try {
            pages.forEachIndexed { index, ops ->
                val info = PdfDocument.PageInfo.Builder(PAGE_W, PAGE_H, index + 1).create()
                val page = document.startPage(info)
                ops.forEach { it(page.canvas) }
                document.finishPage(page)
            }
            val out = ByteArrayOutputStream()
            document.writeTo(out)
            return out.toByteArray()
        } finally {
            document.close()
        }
    }

    /**
     * Two-phase layout: first every drawing operation is placed on a page (with a fixed
     * position captured as a value), then page numbers are added once the total is known.
     */
    private class Layout(private val report: MartingaleReport) {
        private val pages = mutableListOf<MutableList<PdfOp>>()
        private var ops: MutableList<PdfOp> = newPage()
        private var y = MARGIN

        private val titlePaint = paint(18f, bold = true, color = NAVY)
        private val subtitlePaint = paint(9f, color = MUTED)
        private val headingPaint = paint(11f, bold = true, color = NAVY)
        private val labelPaint = paint(10f, color = INK)
        private val valuePaint = paint(10f, bold = true, color = INK, align = Paint.Align.RIGHT)
        private val footerPaint = paint(8f, color = MUTED)
        private val footerRightPaint = paint(8f, color = MUTED, align = Paint.Align.RIGHT)
        private val notePaint = paint(8.5f, color = MUTED)
        private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = BORDER
            style = Paint.Style.STROKE
            strokeWidth = 0.6f
        }
        private val fillPaint = Paint().apply { style = Paint.Style.FILL }

        fun build(): List<List<PdfOp>> {
            drawTitleBlock()
            drawSummary()
            drawTable()
            drawFootnote()
            addFooters()
            return pages
        }

        private fun newPage(): MutableList<PdfOp> {
            val page = mutableListOf<PdfOp>()
            pages += page
            return page
        }

        /** Starts a new page when [height] would not fit above the footer. Returns true if it did. */
        private fun breakPageIfNeeded(height: Float): Boolean {
            if (y + height <= BOTTOM_LIMIT) return false
            ops = newPage()
            y = MARGIN
            return true
        }

        private fun drawTitleBlock() {
            val title = ReportFormatter.title(report)
            val subtitle = ReportFormatter.subtitle()
            val titleY = MARGIN + 18f
            val subtitleY = titleY + 16f
            ops += { c -> c.drawText(title, MARGIN, titleY, titlePaint) }
            ops += { c -> c.drawText(subtitle, MARGIN, subtitleY, subtitlePaint) }
            y = subtitleY + 26f
        }

        private fun drawSummary() {
            val headingY = y
            ops += { c -> c.drawText("Parameters and results", MARGIN, headingY, headingPaint) }
            y += 10f
            ReportFormatter.summary(report).forEachIndexed { index, item ->
                breakPageIfNeeded(18f)
                val rowTop = y
                val baseline = rowTop + 12f
                ops += { c ->
                    if (index % 2 == 1) {
                        fillPaint.color = ALT_ROW
                        c.drawRect(MARGIN, rowTop, MARGIN + TEXT_WIDTH, rowTop + 18f, fillPaint)
                    }
                    c.drawText(item.label, MARGIN + CELL_PAD, baseline, labelPaint)
                    c.drawText(item.value, MARGIN + TEXT_WIDTH - CELL_PAD, baseline, valuePaint)
                }
                y += 18f
            }
            y += 16f
        }

        private fun drawTable() {
            breakPageIfNeeded(HEADER_H + ROW_H * 2)
            val headingY = y + 8f
            ops += { c -> c.drawText("Progression table", MARGIN, headingY, headingPaint) }
            y += 16f
            drawTableHeader()
            report.rows.forEachIndexed { index, row ->
                if (breakPageIfNeeded(ROW_H)) drawTableHeader()
                val fill = when (row.status) {
                    RoundStatus.MAX_AFFORDABLE -> MAX_ROW
                    RoundStatus.STOP_LOSS -> STOP_ROW
                    else -> if (index % 2 == 1) ALT_ROW else Color.WHITE
                }
                val bold = row.status == RoundStatus.MAX_AFFORDABLE || row.status == RoundStatus.STOP_LOSS
                drawRow(ReportFormatter.rowCells(row), y, ROW_H, fill, bold, INK, header = false)
                y += ROW_H
            }
            y += 14f
        }

        private fun drawTableHeader() {
            drawRow(ReportFormatter.TABLE_HEADERS, y, HEADER_H, NAVY, bold = true, color = Color.WHITE, header = true)
            y += HEADER_H
        }

        private fun drawRow(
            cells: List<String>,
            top: Float,
            height: Float,
            fill: Int,
            bold: Boolean,
            color: Int,
            header: Boolean,
        ) {
            var left = MARGIN
            val cellOps = cells.mapIndexed { i, value ->
                val width = COLUMN_WIDTHS[i]
                val align = if (header) Align.CENTER else ALIGNS[i]
                val op = cellText(value, left, width, top, height, bold, color, align)
                left += width
                op
            }
            val right = MARGIN + TEXT_WIDTH
            ops += { c ->
                fillPaint.color = fill
                c.drawRect(MARGIN, top, right, top + height, fillPaint)
                c.drawRect(MARGIN, top, right, top + height, borderPaint)
                var edge = MARGIN
                for (i in 0 until COLUMN_WIDTHS.size - 1) {
                    edge += COLUMN_WIDTHS[i]
                    c.drawLine(edge, top, edge, top + height, borderPaint)
                }
                cellOps.forEach { it(c) }
            }
        }

        /** Shrinks the font only down to [CELL_MIN_TEXT]; a cell's text is never cut off. */
        private fun cellText(
            value: String,
            left: Float,
            width: Float,
            top: Float,
            height: Float,
            bold: Boolean,
            color: Int,
            align: Align,
        ): PdfOp {
            val available = width - 2 * CELL_PAD
            val p = paint(CELL_TEXT, bold = bold, color = color)
            while (p.measureText(value) > available && p.textSize > CELL_MIN_TEXT) {
                p.textSize -= 0.5f
            }
            val baseline = top + height / 2f - (p.ascent() + p.descent()) / 2f
            p.textAlign = when (align) {
                Align.LEFT -> Paint.Align.LEFT
                Align.CENTER -> Paint.Align.CENTER
                Align.RIGHT -> Paint.Align.RIGHT
            }
            val x = when (align) {
                Align.LEFT -> left + CELL_PAD
                Align.CENTER -> left + width / 2f
                Align.RIGHT -> left + width - CELL_PAD
            }
            return { c -> c.drawText(value, x, baseline, p) }
        }

        private fun drawFootnote() {
            breakPageIfNeeded(30f)
            val note = ReportFormatter.footnote(report)
            val noteY = y + 10f
            ops += { c -> c.drawText(note, MARGIN, noteY, notePaint) }
            y += 20f
        }

        private fun addFooters() {
            val total = pages.size
            pages.forEachIndexed { index, page ->
                val number = index + 1
                page += { c ->
                    c.drawLine(MARGIN, FOOTER_Y - 12f, MARGIN + TEXT_WIDTH, FOOTER_Y - 12f, borderPaint)
                    c.drawText("JetCalc · Martingale analysis · Offline", MARGIN, FOOTER_Y, footerPaint)
                    c.drawText("Page $number of $total", MARGIN + TEXT_WIDTH, FOOTER_Y, footerRightPaint)
                }
            }
        }

        private fun paint(
            size: Float,
            bold: Boolean = false,
            color: Int = INK,
            align: Paint.Align = Paint.Align.LEFT,
        ): Paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size
            this.color = color
            typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL)
            fontFeatureSettings = "tnum"
            textAlign = align
        }
    }
}
