package io.github.dcduc168.pwnfox;

import burp.api.montoya.core.HighlightColor;
import burp.api.montoya.http.message.requests.HttpRequest;
import burp.api.montoya.proxy.http.InterceptedRequest;
import burp.api.montoya.proxy.http.ProxyRequestHandler;
import burp.api.montoya.proxy.http.ProxyRequestReceivedAction;
import burp.api.montoya.proxy.http.ProxyRequestToBeSentAction;

import java.util.Locale;

final class PwnFoxProxyRequestHandler implements ProxyRequestHandler {
    private static final String COLOR_HEADER = "X-PwnFox-Color";

    @Override
    public ProxyRequestReceivedAction handleRequestReceived(InterceptedRequest request) {
        String colorName = request.headerValue(COLOR_HEADER);
        if (colorName == null) {
            return ProxyRequestReceivedAction.continueWith(request);
        }

        HttpRequest sanitizedRequest = request.withRemovedHeader(COLOR_HEADER);
        HighlightColor highlightColor = toHighlightColor(colorName);
        if (highlightColor == null) {
            return ProxyRequestReceivedAction.continueWith(sanitizedRequest);
        }

        return ProxyRequestReceivedAction.continueWith(
            sanitizedRequest,
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

        return switch (colorName.trim().toLowerCase(Locale.ROOT)) {
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
