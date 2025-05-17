import { User } from "@supabase/supabase-js";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

const mockUser: User = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  app_metadata: {
    provider: "email",
    providers: ["email"]
  },
  user_metadata: {
    full_name: "John Doe",
    avatar_url: "https://example.com/avatar.jpg"
  },
  aud: "authenticated",
  confirmation_sent_at: "2023-01-15T12:00:00Z",
  recovery_sent_at: "2023-02-20T14:30:00Z",
  email_change_sent_at: "2023-03-10T10:15:00Z",
  new_email: "new.email@example.com",
  new_phone: "+15551234567",
  invited_at: "2023-01-01T00:00:00Z",
  action_link: "https://example.com/verify?token=abc123",
  email: "user@example.com",
  phone: "+15555555555",
  created_at: "2023-01-01T00:00:00Z",
  confirmed_at: "2023-01-02T00:00:00Z",
  email_confirmed_at: "2023-01-02T00:00:00Z",
  phone_confirmed_at: "2023-01-03T00:00:00Z",
  last_sign_in_at: "2023-04-01T09:30:00Z",
  role: "user",
  updated_at: "2023-04-01T09:30:00Z",
  identities: [],
  is_anonymous: false,
  factors: [
    {
      id: "factor_123",
      friendly_name: "John's Phone",
      factor_type: "sms",
      status: "verified",
      created_at: "2023-01-05T00:00:00Z",
      updated_at: "2023-01-05T00:00:00Z"
    }
  ]
};

type UserContentType = {
  getUser: () => Promise<User | undefined>;
  user: User | undefined;
  loading: boolean;
};

const UserContext = createContext<UserContentType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(mockUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user || typeof window === "undefined") return;

    getUser();
  }, []);

  async function getUser() {
    return user
  }

  const contextValue: UserContentType = {
    getUser,
    user,
    loading,
  };

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
