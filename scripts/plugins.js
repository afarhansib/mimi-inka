import { world } from "@minecraft/server";
import { commandManager } from "./commands";
import { playerDB } from "./db";

commandManager.register("test", {
    description: "Custom test command example",
    permission: "admin",
    aliases: ["test"],
    execute: (sender, args) => {
        sender.sendMessage(`§eTest§f: ${args.join(" ")}`);
    }
});

world.afterEvents.playerSpawn.subscribe((event) => {
    const player = event.player;

    // Check for existing tags
    const tags = player.getTags(); // Get all tags
    // console.log(tags); // Log all tags for debugging

    // Extract rank and custom nametag if they exist
    let rankValue = null;
    let nametagValue = null;

    tags.forEach(tag => {
        if (tag.startsWith('rank:')) {
            rankValue = tag.split(':')[1]; // Get the rank value
        }
        if (tag.startsWith('cnat:')) {
            nametagValue = tag.split(':')[1]; // Get the custom nametag value
        }
    });

    // Set customization if tags exist
    if (rankValue) {
        playerDB.setCustomization(player.name, "title", rankValue, "chat"); // Set title in database
        player.removeTag(`rank:${rankValue}`); // Remove the rank tag
    }

    if (nametagValue) {
        playerDB.setCustomization(player.name, "nametag", nametagValue, "chat"); // Set nametag in database
        player.removeTag(`cnat:${nametagValue}`); // Remove the custom nametag tag
    }

    // Check if the player already has an in-game title or nametag
    const existingTitle = playerDB.getCustomization(player.name, "title", "ingame");
    const existingNametag = playerDB.getCustomization(player.name, "nametag", "ingame");

    if (!existingTitle && !existingNametag) {
        // If neither exists, set the in-game title to the current player's nametag
        playerDB.setCustomization(player.name, "title", { text: nametagValue, position: "above" }, "ingame"); // Set title to nametag
    }
});