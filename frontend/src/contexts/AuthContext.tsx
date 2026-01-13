import React, { createContext } from 'react';

interface AuthContextType {
  user: any;
  login: (user: any, token: string) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
});
