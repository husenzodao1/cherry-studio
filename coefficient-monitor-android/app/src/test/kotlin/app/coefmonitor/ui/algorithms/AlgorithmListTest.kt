package app.coefmonitor.ui.algorithms

import app.coefmonitor.core.AlgorithmDefinition
import app.coefmonitor.core.Coefficient
import app.coefmonitor.data.StoredAlgorithm
import org.junit.Assert.assertEquals
import org.junit.Test

class AlgorithmListTest {
    private val two = Coefficient(200)
    private val oneHalf = Coefficient(150)

    private fun algorithm(id: Long, coefficient: Coefficient?, enabled: Boolean = true) =
        StoredAlgorithm(id, id.toInt(), AlgorithmDefinition("A$id", enabled = enabled), coefficient)

    private val all = listOf(
        algorithm(1, two), algorithm(2, oneHalf), algorithm(3, two, enabled = false), algorithm(4, two), algorithm(5, oneHalf), algorithm(6, null),
    )

    @Test
    fun `the current coefficient's algorithms are shown, numbered in its sequence`() {
        val state = AlgorithmsViewModel.listState(all, two, AlgorithmFilter.Current)
        assertEquals(listOf(1L, 3L, 4L, 6L), state.visible.map { it.id })
        // Disabled ones have no number; unassigned ones count with the current coefficient.
        assertEquals(mapOf(1L to 1, 4L to 2, 6L to 3, 2L to 1, 5L to 2), state.numbers)
        assertEquals(two, state.target)
    }

    @Test
    fun `the filter shows another coefficient or all, and lists every coefficient with algorithms`() {
        val other = AlgorithmsViewModel.listState(all, two, AlgorithmFilter.Of(oneHalf))
        assertEquals(listOf(2L, 5L), other.visible.map { it.id })
        assertEquals(oneHalf, other.target)
        assertEquals(6, AlgorithmsViewModel.listState(all, two, AlgorithmFilter.All).visible.size)
        assertEquals(
            listOf(CoefficientGroup(oneHalf, 2, current = false), CoefficientGroup(two, 4, current = true)),
            other.groups,
        )
        // The current coefficient is listed even without algorithms.
        val empty = AlgorithmsViewModel.listState(all, Coefficient(300), AlgorithmFilter.Current)
        assertEquals(true, empty.groups.any { it.coefficient == Coefficient(300) && it.count == 1 && it.current })
    }
}
