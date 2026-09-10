package io.github.dcduc168.pwnfox;

import burp.api.montoya.core.HighlightColor;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

final class PwnFoxProxyRequestHandlerTest {
    @ParameterizedTest
    @CsvSource({
        "blue, BLUE",
        "cyan, CYAN",
        "turquoise, CYAN",
        "gray, GRAY",
        "toolbar, GRAY",
        "green, GREEN",
        "orange, ORANGE",
        "pink, PINK",
        "magenta, MAGENTA",
        "red, RED",
        "yellow, YELLOW"
    })
    void mapsFirefoxColorsToBurpHighlights(String input, HighlightColor expected) {
        assertEquals(expected, PwnFoxProxyRequestHandler.toHighlightColor(input));
    }

    @Test
    void normalizesWhitespaceAndCase() {
        assertEquals(
            HighlightColor.MAGENTA,
            PwnFoxProxyRequestHandler.toHighlightColor("  MaGeNtA  ")
        );
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"purple", "violet", "violet-red", "grey", "black", "unknown"})
    void ignoresUnsupportedColors(String input) {
        assertNull(PwnFoxProxyRequestHandler.toHighlightColor(input));
    }
}
