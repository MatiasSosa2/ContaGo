import assert from 'node:assert/strict'
import test from 'node:test'
import { canAdministerBusiness, canWriteBusiness } from '../src/server/auth/business-access'
import { whereInBusiness } from '../src/server/db/business-scope'

test('only administrators can use administrator-only operations', () => {
  assert.equal(canAdministerBusiness('ADMIN'), true)
  assert.equal(canAdministerBusiness('COLLABORATOR'), false)
  assert.equal(canAdministerBusiness('VIEWER'), false)
})

test('viewers cannot write while collaborators and administrators can', () => {
  assert.equal(canWriteBusiness('ADMIN'), true)
  assert.equal(canWriteBusiness('COLLABORATOR'), true)
  assert.equal(canWriteBusiness('VIEWER'), false)
})

test('business scope overrides a client-supplied tenant id', () => {
  assert.deepEqual(
    whereInBusiness('business-a', {
      id: 'account-a',
      businessId: 'business-b',
    }),
    {
      id: 'account-a',
      businessId: 'business-a',
    },
  )
})
