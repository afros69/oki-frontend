"use client";

import { useEffect, useState } from "react";

export default function Page() {
  const [errorOccurred] = useState(false);

  useEffect(() => {
    async function signOut() {
      console.log("Sign out")
    }
    signOut();
  }, []);

  return (
    <>
      {errorOccurred ? (
        <div>
          <h1>Sign out error</h1>
          <p>
            There was an error signing out. Please refresh the page to try
            again.
          </p>
        </div>
      ) : (
        <p>Signing out...</p>
      )}
    </>
  );
}
