'use client'

import { ResponsiveContainer as RechartsResponsiveContainer } from 'recharts'
import type { ComponentProps } from 'react'

type Props = ComponentProps<typeof RechartsResponsiveContainer>

export function ResponsiveChartContainer({ initialDimension, ...props }: Props) {
  return (
    <RechartsResponsiveContainer
      {...props}
      initialDimension={initialDimension ?? { width: 800, height: 300 }}
    />
  )
}
