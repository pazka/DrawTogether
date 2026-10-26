"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateMd5ToSha256 = migrateMd5ToSha256;
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const MD5_NAME = /^[0-9a-f]{32}$/;
function hash(algorithm, key) {
    return crypto.createHash(algorithm).update(key).digest('hex');
}
function exists(file) {
    try {
        fs.lstatSync(file);
        return true;
    }
    catch (e) {
        if (e.code === 'ENOENT')
            return false;
        throw e;
    }
}
function writeAtomically(dir, name, text) {
    const tmp = path.join(dir, `.${name}.migrating`);
    try {
        const fd = fs.openSync(tmp, 'w');
        try {
            fs.writeFileSync(fd, text, 'utf8');
            fs.fsyncSync(fd);
        }
        finally {
            fs.closeSync(fd);
        }
        fs.renameSync(tmp, path.join(dir, name));
    }
    catch (e) {
        try {
            fs.unlinkSync(tmp);
        }
        catch (ignored) { }
        throw e;
    }
}
function migrateMd5ToSha256(dir, log = console.log) {
    const result = { copied: 0, alreadyMigrated: 0, skipped: 0 };
    let names;
    try {
        names = fs.readdirSync(dir);
    }
    catch (e) {
        if (e.code !== 'ENOENT')
            log(`node-persist migration: cannot list ${dir} (${e.code || e.message})`);
        return result;
    }
    for (const name of names) {
        if (!MD5_NAME.test(name))
            continue;
        const file = path.join(dir, name);
        try {
            if (!fs.lstatSync(file).isFile())
                throw new Error('not a regular file');
            const text = fs.readFileSync(file, 'utf8');
            const datum = JSON.parse(text);
            if (!datum || typeof datum.key !== 'string' || !datum.key)
                throw new Error('no key');
            if (hash('md5', datum.key) !== name)
                throw new Error('name is not md5(key)');
            const target = hash('sha256', datum.key);
            if (exists(path.join(dir, target))) {
                result.alreadyMigrated++;
                continue;
            }
            writeAtomically(dir, target, text);
            result.copied++;
        }
        catch (e) {
            result.skipped++;
            log(`node-persist migration: skipped ${name} (${e.code || e.message})`);
        }
    }
    log(`node-persist migration (md5 -> sha256 names) in ${dir}: ${result.copied} copied, ` +
        `${result.alreadyMigrated} already migrated, ${result.skipped} skipped`);
    return result;
}
//# sourceMappingURL=persistMigration.js.map