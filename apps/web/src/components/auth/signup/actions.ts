"use server";

import { redirect } from "next/navigation";

import { SignupWithEmailInput } from "./Signup";

export async function signup(input: SignupWithEmailInput, baseUrl: string) {
  // Users still need to confirm their email address.
  // This page will show a message to check their email.
  redirect("/auth/signup/success");
}
