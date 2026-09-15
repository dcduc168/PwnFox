package io.github.dcduc168.pwnfox;

import burp.api.montoya.BurpExtension;
import burp.api.montoya.MontoyaApi;
import burp.api.montoya.ui.settings.SettingsPanelBuilder;
import burp.api.montoya.ui.settings.SettingsPanelPersistence;
import burp.api.montoya.ui.settings.SettingsPanelSetting;
import burp.api.montoya.ui.settings.SettingsPanelWithData;

public final class PwnFoxExtension implements BurpExtension {
    static final String STRIP_SETTING = "Replace color header";

    @Override
    public void initialize(MontoyaApi api) {
        api.extension().setName("PwnFox");
        SettingsPanelWithData settings = SettingsPanelBuilder.settingsPanel()
            .withPersistence(SettingsPanelPersistence.USER_SETTINGS)
            .withTitle("PwnFox")
            .withDescription("Requests with X-PwnFox-Color are highlighted. Enable Replace color header to strip it before the request is sent.")
            .withSetting(SettingsPanelSetting.booleanSetting(STRIP_SETTING, false))
            .build();
        api.userInterface().registerSettingsPanel(settings);
        api.proxy().registerRequestHandler(new PwnFoxProxyRequestHandler(settings));
        api.logging().logToOutput("PwnFox loaded");
    }
}
