"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, signUp } from "@/lib/auth"

export default function LoginPage() {
  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

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
        onClick={async () => {
          const { error } = await signIn(login, password)

          if (!error) {
            router.push("/dashboard")
          } else {
            alert("Login error")
            console.log(error)
          }
        }}
        className="bg-blue-500 text-white p-2"
      >
        Login
      </button>

      {/* REGISTER */}
      <button
        onClick={async () => {
          const { error } = await signUp(login, password)

          if (!error) {
            router.push("/dashboard")
          } else {
            alert("Register error")
            console.log(error)
          }
        }}
        className="bg-green-500 text-white p-2"
      >
        Register
      </button>
    </div>
  )
}