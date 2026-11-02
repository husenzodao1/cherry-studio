package app.coefmonitor.core

/**
 * Lines up the rounds counted last with the tiles of the row, to tell which tiles are new.
 *
 * Both lists are newest first. The known rounds must appear in the row as a run of consecutive
 * tiles; every tile before that run ended after them. At least two known rounds must match (or
 * all of them, when fewer are known), so a single equal value never decides on its own.
 */
object RowHistory {
    /** Known rounds compared with the row, at most. */
    const val MATCH = 3

    /**
     * Number of new tiles (0: none), or null when the known rounds are not in the row (more rounds
     * ended than it shows) or a new tile could not be read.
     */
    fun newTiles(known: List<Coefficient>, tiles: List<Coefficient?>): Int? {
        if (known.isEmpty()) return null
        val minimum = minOf(2, known.size)
        for (fresh in tiles.indices) {
            val compared = minOf(MATCH, known.size, tiles.size - fresh)
            if (compared < minimum) return null
            if ((0 until compared).all { j -> tiles[fresh + j] == known[j] }) {
                return fresh.takeIf { (0 until fresh).all { tiles[it] != null } }
            }
        }
        return null
    }
}
