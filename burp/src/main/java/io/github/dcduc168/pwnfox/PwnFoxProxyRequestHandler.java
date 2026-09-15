package io.github.dcduc168.pwnfox;

import burp.api.montoya.core.HighlightColor;
import burp.api.montoya.http.message.requests.HttpRequest;
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
        HttpRequest outgoing = settings.getBoolean(PwnFoxExtension.STRIP_SETTING)
            ? request.withRemovedHeader(COLOR_HEADER)
            : request;
        if (highlightColor == null) {
            return ProxyRequestReceivedAction.continueWith(outgoing);
        }

        return ProxyRequestReceivedAction.continueWith(
            outgoing,
            request.annotations().withHighlightColor(highlightColor)
        );
    }

    @Override
    public ProxyRequestToBeSentAction handleRequestToBeSent(InterceptedRequest request) {
        return ProxyRequestToBeSentAction.continueWith(request);
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
