import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-semibold mb-2">foundr-money</h1>
      <p className="text-sm text-slate-500 mb-8">project-first agent-native budgeting for the multi-project micro-founder</p>

      <SignedOut>
        <SignInButton mode="modal">
          <button className="px-4 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

      <SignedIn>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-700">Signed in.</span>
          <UserButton afterSignOutUrl="/" />
        </div>
      </SignedIn>
    </main>
  )
}
