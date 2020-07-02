import { expect } from 'chai'
import Knex from 'knex'

import { config } from '../config'
import { createSchema } from './creator'
import { executeSchemaMigration, Migrations } from './migration'

describe('schema migration', () => {
  const schemaName = 'new_schema'
  const knex = Knex(config.knex)

  const getSchemaTables = async () =>
    (
      await knex.raw(`
      SELECT
        table_name
      FROM
        information_schema.tables
      WHERE
        table_schema = '${schemaName}'
      AND table_type = 'BASE TABLE';`)
    ).rows

  beforeEach(async () => {
    await knex.raw(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`)
    await createSchema({ knex, schemaName })
  })

  it('creates knex migrations and users table for a given schema', async () => {
    await executeSchemaMigration({ knex, schemaName, migrations: migrationsFixture })

    const tables = await getSchemaTables()

    expect(tables).to.have.length(3)
    expect(tables).to.have.deep.members([
      {
        table_name: 'knex_migrations',
      },
      {
        table_name: 'knex_migrations_lock',
      },
      {
        table_name: 'users',
      },
    ])
  })

  it('accepts migrations for new tables and saves the keys in the knex migrations table', async () => {
    await executeSchemaMigration({ knex, schemaName, migrations: migrationsFixture })
    await executeSchemaMigration({
      knex,
      schemaName,
      migrations: { ...migrationsFixture, tokens: tokensMigrationFixture },
    })

    const tables = await getSchemaTables()
    const knexMigrations = (await knex(`${schemaName}.knex_migrations`)).map(({ name }) => name)

    expect(tables).to.have.length(4)
    expect(tables).to.have.deep.members([
      {
        table_name: 'knex_migrations',
      },
      {
        table_name: 'knex_migrations_lock',
      },
      {
        table_name: 'users',
      },
      {
        table_name: 'tokens',
      },
    ])

    expect(knexMigrations).to.have.deep.members(['users', 'tokens'])
  })

  it('fails when changing the migrations object', async () => {
    await executeSchemaMigration({ knex, schemaName, migrations: migrationsFixture })
    const error = await executeSchemaMigration({ knex, schemaName, migrations: {} })

    expect(error).to.match(/The migration directory is corrupt, the following files are missing: users/)
  })
})

const usersMigrationFixture = (schemaName: string) => ({
  async up(knex: Knex) {
    return knex.schema.withSchema(schemaName).createTable('users', (table) => {
      table.increments('id').primary()
    })
  },
  async down(knex: Knex) {
    return knex.schema.withSchema(schemaName).dropTableIfExists('users')
  },
})

const tokensMigrationFixture = (schemaName: string) => ({
  async up(knex: Knex) {
    return knex.schema.withSchema(schemaName).createTable('tokens', (table) => {
      table.increments('id').primary()
    })
  },
  async down(knex: Knex) {
    return knex.schema.withSchema(schemaName).dropTableIfExists('tokens')
  },
})

const migrationsFixture: Migrations = {
  users: usersMigrationFixture,
}
