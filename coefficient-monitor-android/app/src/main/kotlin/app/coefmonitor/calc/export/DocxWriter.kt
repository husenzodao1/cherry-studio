package app.coefmonitor.calc.export

import app.coefmonitor.calc.calculator.MartingaleReport
import app.coefmonitor.calc.calculator.RoundStatus
import java.io.ByteArrayOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Writes a Word 2007+ (.docx) package without a third-party library.
 * Parts: [Content_Types].xml, _rels/.rels, word/document.xml, word/styles.xml,
 * word/footer1.xml, word/_rels/document.xml.rels. The file is a standard OPC zip.
 */
object DocxWriter {
    private const val NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    private const val REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

    // A4 page with 2 cm margins: text width = 11906 - 2 * 1134 = 9638 twips.
    private const val PAGE_W = 11906
    private const val PAGE_H = 16838
    private const val MARGIN = 1134
    private const val TEXT_WIDTH = PAGE_W - 2 * MARGIN

    /** Main table column widths in twips; they sum exactly to TEXT_WIDTH. */
    private val COLUMN_WIDTHS = intArrayOf(900, 1500, 2000, 1900, 1900, 1438)

    private const val NAVY = "1F3A5F"
    private const val BORDER = "C9CED6"
    private const val ALT_ROW = "F4F6F9"
    private const val MAX_ROW = "DCE7F5"
    private const val STOP_ROW = "F8E1DE"
    private const val TEXT = "1C1F26"
    private const val MUTED = "5B6472"

    fun write(report: MartingaleReport): ByteArray {
        require(COLUMN_WIDTHS.sum() == TEXT_WIDTH) { "Column widths must fill the text width" }
        val out = ByteArrayOutputStream()
        ZipOutputStream(out).use { zip ->
            zip.putText("[Content_Types].xml", contentTypes())
            zip.putText("_rels/.rels", rootRels())
            zip.putText("word/document.xml", document(report))
            zip.putText("word/styles.xml", styles())
            zip.putText("word/footer1.xml", footer())
            zip.putText("word/_rels/document.xml.rels", documentRels())
        }
        return out.toByteArray()
    }

    private fun ZipOutputStream.putText(name: String, content: String) {
        putNextEntry(ZipEntry(name))
        write(content.toByteArray(Charsets.UTF_8))
        closeEntry()
    }

    private fun contentTypes(): String = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>"""

    private fun rootRels(): String = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    private fun documentRels(): String = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>"""

    private fun styles(): String = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="$NS">
<w:docDefaults>
<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/><w:color w:val="$TEXT"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>
</w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>"""

    private fun footer(): String = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="$NS">
<w:p><w:pPr><w:spacing w:before="120"/><w:jc w:val="center"/></w:pPr>
<w:r><w:rPr><w:color w:val="$MUTED"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">JetCalc · Martingale analysis · Page </w:t></w:r>
<w:fldSimple w:instr=" PAGE "><w:r><w:rPr><w:color w:val="$MUTED"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>
<w:r><w:rPr><w:color w:val="$MUTED"/><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> of </w:t></w:r>
<w:fldSimple w:instr=" NUMPAGES "><w:r><w:rPr><w:color w:val="$MUTED"/><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple>
</w:p>
</w:ftr>"""

    private fun document(report: MartingaleReport): String {
        val body = StringBuilder()
        body.append(paragraph(ReportFormatter.title(report), size = 32, bold = true, color = NAVY, after = 60))
        body.append(paragraph(ReportFormatter.subtitle(), size = 18, color = MUTED, after = 280))
        body.append(paragraph("Parameters and results", size = 24, bold = true, color = NAVY, after = 120))
        body.append(summaryTable(ReportFormatter.summary(report)))
        body.append(paragraph("", after = 240))
        body.append(paragraph("Progression table", size = 24, bold = true, color = NAVY, after = 120))
        body.append(progressionTable(report))
        body.append(paragraph(ReportFormatter.footnote(report), size = 18, color = MUTED, before = 200))

        return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="$NS" xmlns:r="$REL_NS">
<w:body>
$body
<w:sectPr>
<w:footerReference w:type="default" r:id="rId2"/>
<w:pgSz w:w="$PAGE_W" w:h="$PAGE_H"/>
<w:pgMar w:top="$MARGIN" w:right="$MARGIN" w:bottom="$MARGIN" w:left="$MARGIN" w:header="567" w:footer="567" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>"""
    }

    private fun summaryTable(items: List<SummaryItem>): String {
        val widths = intArrayOf(5200, TEXT_WIDTH - 5200)
        val rows = items.mapIndexed { index, item ->
            val fill = if (index % 2 == 1) ALT_ROW else null
            tableRow(
                cells = listOf(item.label, item.value),
                widths = widths,
                fill = fill,
                align = listOf("left", "right"),
                bold = false,
                color = TEXT,
                header = false,
            )
        }
        return table(widths, rows)
    }

    private fun progressionTable(report: MartingaleReport): String {
        val headerRow = tableRow(
            cells = ReportFormatter.TABLE_HEADERS,
            widths = COLUMN_WIDTHS,
            fill = NAVY,
            align = listOf("center", "right", "right", "right", "right", "center"),
            bold = true,
            color = "FFFFFF",
            header = true,
        )
        val dataRows = report.rows.mapIndexed { index, row ->
            val (fill, bold) = when (row.status) {
                RoundStatus.MAX_AFFORDABLE -> MAX_ROW to true
                RoundStatus.STOP_LOSS -> STOP_ROW to true
                else -> (if (index % 2 == 1) ALT_ROW else null) to false
            }
            tableRow(
                cells = ReportFormatter.rowCells(row),
                widths = COLUMN_WIDTHS,
                fill = fill,
                align = listOf("center", "right", "right", "right", "right", "center"),
                bold = bold,
                color = TEXT,
                header = false,
            )
        }
        return table(COLUMN_WIDTHS, listOf(headerRow) + dataRows)
    }

    private fun table(widths: IntArray, rows: List<String>): String {
        val grid = widths.joinToString("") { "<w:gridCol w:w=\"$it\"/>" }
        val borders = listOf("top", "left", "bottom", "right", "insideH", "insideV")
            .joinToString("") { "<w:$it w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"$BORDER\"/>" }
        return """<w:tbl>
<w:tblPr><w:tblW w:w="$TEXT_WIDTH" w:type="dxa"/><w:tblBorders>$borders</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>
<w:tblGrid>$grid</w:tblGrid>
${rows.joinToString("\n")}
</w:tbl>"""
    }

    private fun tableRow(
        cells: List<String>,
        widths: IntArray,
        fill: String?,
        align: List<String>,
        bold: Boolean,
        color: String,
        header: Boolean,
    ): String {
        val trPr = buildString {
            append("<w:trPr><w:cantSplit/>")
            if (header) append("<w:tblHeader/>")
            append("</w:trPr>")
        }
        val tcs = cells.mapIndexed { i, text ->
            val shade = if (fill != null) "<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"$fill\"/>" else ""
            """<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/>$shade<w:vAlign w:val="center"/></w:tcPr>${paragraph(text, size = 18, bold = bold, color = color, align = align[i], before = 0, after = 0)}</w:tc>"""
        }
        return "<w:tr>$trPr${tcs.joinToString("")}</w:tr>"
    }

    private fun paragraph(
        text: String,
        size: Int = 20,
        bold: Boolean = false,
        color: String = TEXT,
        align: String = "left",
        before: Int = 0,
        after: Int = 0,
    ): String {
        val rPr = buildString {
            if (bold) append("<w:b/>")
            append("<w:color w:val=\"$color\"/>")
            append("<w:sz w:val=\"$size\"/><w:szCs w:val=\"$size\"/>")
        }
        val run = if (text.isEmpty()) "" else "<w:r><w:rPr>$rPr</w:rPr><w:t xml:space=\"preserve\">${escape(text)}</w:t></w:r>"
        return "<w:p><w:pPr><w:spacing w:before=\"$before\" w:after=\"$after\"/><w:jc w:val=\"$align\"/></w:pPr>$run</w:p>"
    }

    internal fun escape(text: String): String = buildString(text.length) {
        for (ch in text) {
            when (ch) {
                '&' -> append("&amp;")
                '<' -> append("&lt;")
                '>' -> append("&gt;")
                '"' -> append("&quot;")
                '\'' -> append("&apos;")
                else -> append(ch)
            }
        }
    }
}
