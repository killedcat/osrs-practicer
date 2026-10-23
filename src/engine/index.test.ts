import { expect, it } from 'vitest'
import * as engine from './index'

it('engine placeholder is a framework-free module', () => {
  expect(Object.keys(engine)).toEqual([])
})
