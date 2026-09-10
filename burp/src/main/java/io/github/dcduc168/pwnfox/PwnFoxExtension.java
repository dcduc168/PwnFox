package io.github.dcduc168.pwnfox;

import burp.api.montoya.BurpExtension;
import burp.api.montoya.MontoyaApi;

public final class PwnFoxExtension implements BurpExtension {
    @Override
    public void initialize(MontoyaApi api) {
        api.extension().setName("PwnFox");
        api.proxy().registerRequestHandler(new PwnFoxProxyRequestHandler());
        api.logging().logToOutput("PwnFox loaded");
    }
}
