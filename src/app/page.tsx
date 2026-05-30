import { MarketingNav } from '@/components/marketing/MarketingNav'
import { Hero } from '@/components/marketing/Hero'
import { WhatItIs } from '@/components/marketing/WhatItIs'
import { HowItWorks } from '@/components/marketing/HowItWorks'
import { WhatMakesItDifferent } from '@/components/marketing/WhatMakesItDifferent'
import { IncumbentGap } from '@/components/marketing/IncumbentGap'
import { WhyItExists } from '@/components/marketing/WhyItExists'
import { PricingTeaser } from '@/components/marketing/PricingTeaser'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'

// Public marketing landing — fully static / prerenderable under cacheComponents.
// No Clerk session hooks anywhere in this tree. Section bands alternate
// white / slate-50 down the page.
export default function Home() {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <MarketingNav />
      <main>
        <Hero />
        <WhatItIs />
        <HowItWorks />
        <WhatMakesItDifferent />
        <IncumbentGap />
        <WhyItExists />
        <PricingTeaser />
      </main>
      <MarketingFooter />
    </div>
  )
}
