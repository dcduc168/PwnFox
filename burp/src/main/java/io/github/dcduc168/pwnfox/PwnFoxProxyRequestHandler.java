package io.github.dcduc168.pwnfox;

import burp.api.montoya.core.HighlightColor;
import burp.api.montoya.proxy.http.InterceptedRequest;
import burp.api.montoya.proxy.http.ProxyRequestHandler;
import burp.api.montoya.proxy.http.ProxyRequestReceivedAction;
import burp.api.montoya.proxy.http.ProxyRequestToBeSentAction;
import burp.api.montoya.ui.settings.SettingsPanelWithData;

import java.util.Locale;

final class PwnFoxProxyRequestHandler implements ProxyRequestHandler {
    private static final String COLOR_HEADER = "X-PwnFox-Color";

    private final SettingsPanelWithData settings;

    PwnFoxProxyRequestHandler(SettingsPanelWithData settings) {
        this.settings = settings;
    }

    @Override
    public ProxyRequestReceivedAction handleRequestReceived(InterceptedRequest request) {
        String colorName = request.headerValue(COLOR_HEADER);
        if (colorName == null) {
            return ProxyRequestReceivedAction.continueWith(request);
        }

        HighlightColor highlightColor = toHighlightColor(colorName);
        if (highlightColor == null) {
            return ProxyRequestReceivedAction.continueWith(request);
        }

        return ProxyRequestReceivedAction.continueWith(
            request,
            request.annotations().withHighlightColor(highlightColor)
        );
    }

    @Override
    public ProxyRequestToBeSentAction handleRequestToBeSent(InterceptedRequest request) {
        if (!settings.getBoolean(PwnFoxExtension.STRIP_SETTING)
            || request.headerValue(COLOR_HEADER) == null) {
            return ProxyRequestToBeSentAction.continueWith(request);
        }
        return ProxyRequestToBeSentAction.continueWith(request.withRemovedHeader(COLOR_HEADER));
    }

    static HighlightColor toHighlightColor(String colorName) {
        if (colorName == null) {
            return null;
        }

        HighlightColor exactMatch = exactHighlightColor(colorName);
        if (exactMatch != null) {
            return exactMatch;
        }

        String normalizedName = colorName.trim().toLowerCase(Locale.ROOT);
        return normalizedName.equals(colorName) ? null : exactHighlightColor(normalizedName);
    }

    private static HighlightColor exactHighlightColor(String colorName) {
        return switch (colorName) {
            case "blue" -> HighlightColor.BLUE;
            // Firefox renamed turquoise to cyan and toolbar to gray.
            case "cyan", "turquoise" -> HighlightColor.CYAN;
            case "gray", "toolbar" -> HighlightColor.GRAY;
            case "green" -> HighlightColor.GREEN;
            case "orange" -> HighlightColor.ORANGE;
            case "pink" -> HighlightColor.PINK;
            case "magenta" -> HighlightColor.MAGENTA;
            case "red" -> HighlightColor.RED;
            case "yellow" -> HighlightColor.YELLOW;
            default -> null;
        };
    }
}
