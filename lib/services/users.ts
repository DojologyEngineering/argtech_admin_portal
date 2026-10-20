/** Team account management. */

import { commit, delay, getDb, newId, NotFoundError } from "../mock/store";
import { todayISO } from "../format";
import type { AppUser, ID, UserRole, UserStatus } from "../types";

export interface UserInput {
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
}

export async function listUsers(): Promise<AppUser[]> {
  const users = [...getDb().users].sort((a, b) =>
    a.username.localeCompare(b.username),
  );
  return delay(users);
}

export async function getUser(id: ID): Promise<AppUser> {
  const user = getDb().users.find((u) => u.id === id);
  if (!user) throw new NotFoundError("User", id);
  return delay(user);
}

export async function createUser(input: UserInput): Promise<AppUser> {
  return commit((db) => {
    const clash = db.users.find(
      (u) => u.username.toLowerCase() === input.username.trim().toLowerCase(),
    );
    if (clash) throw new Error(`Username "${input.username}" is already taken.`);
    const user: AppUser = {
      id: newId("user"),
      username: input.username.trim(),
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      role: input.role,
      status: input.status,
      createdAt: todayISO(),
    };
    db.users.push(user);
    return { ...user };
  });
}

export async function updateUser(
  id: ID,
  input: Partial<UserInput>,
): Promise<AppUser> {
  return commit((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new NotFoundError("User", id);
    if (input.username) {
      const clash = db.users.find(
        (u) =>
          u.id !== id &&
          u.username.toLowerCase() === input.username!.trim().toLowerCase(),
      );
      if (clash) throw new Error(`Username "${input.username}" is already taken.`);
    }
    Object.assign(user, {
      ...input,
      username: input.username?.trim() ?? user.username,
      fullName: input.fullName?.trim() ?? user.fullName,
      email: input.email?.trim() ?? user.email,
    });
    return { ...user };
  });
}

/** Flips Active <-> Inactive without touching anything else. */
export async function toggleUserStatus(id: ID): Promise<AppUser> {
  return commit((db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) throw new NotFoundError("User", id);
    user.status = user.status === "Active" ? "Inactive" : "Active";
    return { ...user };
  });
}

/**
 * Password reset. There are no passwords to rotate in this phase, so this
 * records the intent and returns a temporary credential for the admin to pass on.
 */
export async function resetUserPassword(id: ID): Promise<string> {
  const user = getDb().users.find((u) => u.id === id);
  if (!user) throw new NotFoundError("User", id);
  const temp = `argtech-${Math.random().toString(36).slice(2, 8)}`;
  return delay(temp, 200);
}
