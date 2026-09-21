import { describe, expect, it } from 'vitest'
import { parseRosterCsv } from './csv'

describe('parseRosterCsv', () => {
  it('parses rows and skips a recognized header', () => {
    const csv =
      'manager_name,manager_email,reportee_name,reportee_designation\n' +
      'Ashruti Sharma,ashruti@acme.com,Sanket Patil,Senior Engineer\n' +
      'Ashruti Sharma,ashruti@acme.com,Priya Nair,Engineer\n'
    const { rows, error } = parseRosterCsv(csv)
    expect(error).toBeNull()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({
      manager_name: 'Ashruti Sharma',
      manager_email: 'ashruti@acme.com',
      reportee_name: 'Sanket Patil',
      reportee_designation: 'Senior Engineer',
    })
  })

  it('handles quoted fields containing commas', () => {
    const csv = 'manager_name,manager_email,reportee_name,reportee_designation\nA B,"a@acme.com",C D,"Engineer, Senior"\n'
    const { rows } = parseRosterCsv(csv)
    expect(rows[0].reportee_designation).toBe('Engineer, Senior')
  })

  it('treats a file with no recognized header as all data rows', () => {
    const csv = 'A,a@acme.com,B,Engineer\n'
    const { rows } = parseRosterCsv(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].manager_name).toBe('A')
  })

  it('returns an error for an empty file', () => {
    expect(parseRosterCsv('').error).not.toBeNull()
  })
})
