import { supabase } from "./supabase"

const makeEmail = (login: string) => {
  return `${login.toLowerCase()}@worldcup.local`
}

export const signUp = async (login: string, password: string) => {
  const email = makeEmail(login)

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  return { data, error }
}

export const signIn = async (login: string, password: string) => {
  const email = makeEmail(login)

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error }
}

export const signOut = async () => {
  await supabase.auth.signOut()
}