import { world, system } from "@minecraft/server";
import { configManager } from "./config.js";
import { CommandGUI } from "./gui.js";

export class MenuManager {
    static openMenuWithDelay(player) {
        if (!this.checkPermission(player)) {
            player.sendMessage(configManager.get("chatPrefix") + "§cYou don't have permission to use this!");
            return;
        }

        const delay = configManager.get("guiOpenDelay");
        const message = configManager.get("guiOpenMessage")
            .replace("{delay}", delay);

        // Show instruction message
        player.sendMessage(message);

        // Schedule menu to open after delay
        system.runTimeout(() => {
            CommandGUI.showMainMenu(player);
        }, Math.floor(delay * 20)); // Convert seconds to ticks
    }

    static checkPermission(player) {
        const adminTag = configManager.get("adminTag");
        return player.hasTag(adminTag);
    }

    static isGuiItem(itemStack) {
        if (!itemStack) return false;
        const guiItem = configManager.get("guiItem");
        return itemStack.typeId === guiItem.typeId && itemStack?.nameTag === guiItem.nameTag;
    }
}

// Register item use event
world.beforeEvents.itemUse.subscribe((event) => {
    const player = event.source;
    const item = event.itemStack;

    system.run(() => {
        if (MenuManager.isGuiItem(item) && MenuManager.checkPermission(player)) {
            event.cancel = true;
            CommandGUI.showMainMenu(player);
        }
    })
});
