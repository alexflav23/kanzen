import { z } from "zod";
import { api } from "./http";

/** F48 RT.4 — chats (DM/group). Messages ride the generic comment path (entityType='chat'); these endpoints just
 *  manage the chat list + membership. */
export const ChatSchema = z.object({
  id: z.string(),
  members: z.array(z.string()),
  lastMessage: z.string().nullable(),
  lastAt: z.string().nullable(),
});
export type Chat = z.infer<typeof ChatSchema>;
const ChatsSchema = z.array(ChatSchema);

export const listChats = (token: string | null): Promise<Chat[]> =>
  api("/api/chats", ChatsSchema, { token });

export const createChat = (memberUserIds: string[], token: string | null): Promise<Chat> =>
  api("/api/chats", ChatSchema, { method: "POST", body: { memberUserIds }, token });
