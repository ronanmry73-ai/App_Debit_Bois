import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("debitBoisDesktop", {
  isDesktop: true,
  platform: process.platform,
});
