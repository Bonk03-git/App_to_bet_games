"use client"

import { useState } from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp } from "@/lib/auth"
import { useUser } from "@/lib/useUser"

export default function LoginPage() {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const { user } = useUser()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
  if (user) {
    router.push("/dashboard")
  }
  }, [user])

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col gap-3 w-full max-w-sm bg-zinc-900 p-6 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold">World Cup Login</h1>

      <input
        placeholder="login"
        className="bg-zinc-800 text-white p-2 rounded-lg outline-none"
        onChange={(e) => setLogin(e.target.value)}
      />

      <input
        placeholder="password"
        type="password"
        className="bg-zinc-800 text-white p-2 rounded-lg outline-none"
        onChange={(e) => setPassword(e.target.value)}
      />

      {/* LOGIN */}
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true)
          setError("")

          const { error } = await signIn(login, password)

          setLoading(false)

          if (!error) {
            router.push("/dashboard")
          } else {
            if (error.message.includes("Invalid login credentials")) {
              setError("Złe hasło lub login")
            } else {
              setError("Błąd logowania")
            }
          }
        }}
        className="bg-blue-600 hover:bg-blue-500 transition text-white p-2 rounded-lg"
      >
        {loading ? "Loading..." : "Login"}
      </button>

      {/* REGISTER */}
      <button
        onClick={async () => {
          const { error } = await signUp(login, password)

          if (!error) {
            router.push("/dashboard")
          } else {
            if (error.message.includes("already")) {
              setError("Istnieje już taki użytkownik")
            } else {
              setError(error.message)
            }
        }
        }}
        className="bg-green-600 hover:bg-green-500 transition text-white p-2 rounded-lg"
      >
        Register
    </button>

    {error && (
      <div className="text-red-400 text-sm mt-2 text-center">
        {error}
      </div>
    )}
      </div>
    </div>
  )
}