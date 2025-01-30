import { commandManager } from "./commands";

commandManager.register("test", {
    description: "Custom test command example",
    permission: "admin",
    aliases: ["test"],
    execute: (sender, args) => {
        sender.sendMessage(`§eTest§f: ${args.join(" ")}`);
    }
});