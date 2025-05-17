"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { LoginWithEmailInput } from "./Login";

export async function login(input: LoginWithEmailInput) {
  revalidatePath("/", "layout");
  redirect("/");
}
