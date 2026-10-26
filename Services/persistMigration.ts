import crypto = require('crypto')
import fs = require('fs')
import path = require('path')

// node-persist 3 stored each key in a file named md5(key); node-persist 4 names it sha256(key) and has no
// migration, so every room written by 3.x would be invisible (MIGRATIONS.md, 2026-10-26).
// This copies each 3.x file to its 4.x name before the first read:
//   - only md5-named regular files whose JSON {key, value, ttl} hashes back to their name (never follows
//     symlinks, never reads outside dir); anything else is skipped and logged, never fatal;
//   - only when the sha256 file does not exist yet (idempotent, never overwrites what 4.x wrote);
//   - the exact bytes, via a dot-prefixed temp file + rename (node-persist ignores dotfiles);
//   - the md5 originals are kept, so going back to a 3.x image finds the pre-upgrade rooms.
export interface MigrationResult {
    copied: number
    alreadyMigrated: number
    skipped: number
}

const MD5_NAME = /^[0-9a-f]{32}$/

function hash(algorithm: string, key: string): string {
    return crypto.createHash(algorithm).update(key).digest('hex')
}

function exists(file: string): boolean {
    try {
        fs.lstatSync(file)
        return true
    } catch (e) {
        if (e.code === 'ENOENT') return false
        throw e
    }
}

function writeAtomically(dir: string, name: string, text: string) {
    const tmp = path.join(dir, `.${name}.migrating`)
    try {
        const fd = fs.openSync(tmp, 'w')
        try {
            fs.writeFileSync(fd, text, 'utf8')
            fs.fsyncSync(fd)
        } finally {
            fs.closeSync(fd)
        }
        fs.renameSync(tmp, path.join(dir, name))
    } catch (e) {
        try { fs.unlinkSync(tmp) } catch (ignored) { }
        throw e
    }
}

export function migrateMd5ToSha256(dir: string, log: (msg: string) => void = console.log): MigrationResult {
    const result: MigrationResult = {copied: 0, alreadyMigrated: 0, skipped: 0}
    let names: string[]
    try {
        names = fs.readdirSync(dir)
    } catch (e) {
        if (e.code !== 'ENOENT') log(`node-persist migration: cannot list ${dir} (${e.code || e.message})`)
        return result
    }

    for (const name of names) {
        if (!MD5_NAME.test(name)) continue // 4.x files (64 hex chars), dotfiles, anything else
        const file = path.join(dir, name)
        try {
            if (!fs.lstatSync(file).isFile()) throw new Error('not a regular file')
            const text = fs.readFileSync(file, 'utf8')
            const datum = JSON.parse(text)
            if (!datum || typeof datum.key !== 'string' || !datum.key) throw new Error('no key')
            if (hash('md5', datum.key) !== name) throw new Error('name is not md5(key)')
            const target = hash('sha256', datum.key)
            if (exists(path.join(dir, target))) {
                result.alreadyMigrated++
                continue
            }
            writeAtomically(dir, target, text)
            result.copied++
        } catch (e) {
            result.skipped++
            log(`node-persist migration: skipped ${name} (${e.code || e.message})`)
        }
    }
    log(`node-persist migration (md5 -> sha256 names) in ${dir}: ${result.copied} copied, ` +
        `${result.alreadyMigrated} already migrated, ${result.skipped} skipped`)
    return result
}
