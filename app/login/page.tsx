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
    <div className="flex flex-col gap-2 p-10 max-w-sm">
      <h1 className="text-2xl font-bold">World Cup Login</h1>

      <input
        placeholder="login"
        className="border p-2"
        onChange={(e) => setLogin(e.target.value)}
      />

      <input
        placeholder="password"
        type="password"
        className="border p-2"
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
        className="bg-blue-500 text-white p-2"
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
        className="bg-green-500 text-white p-2"
      >
        Register
    </button>

    {error && (
      <div className="text-red-500 mt-2">
        {error}
      </div>
    )}

    </div>
  )
}