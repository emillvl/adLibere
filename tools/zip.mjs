import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { crc32, deflateRawSync, inflateRawSync } from 'node:zlib';

// ZIP32 with sorted UTF-8 paths, fixed 1980-01-01 timestamps and Unix 0644 modes.
// No clocks, absolute paths, extra fields, comments or browser caches are embedded.
export function createZip(directory, files) {
  const local = [];
  const central = [];
  let offset = 0;
  assert.ok(files.length < 65535);
  for (const file of [...files].sort()) {
    assert.ok(!file.startsWith('/') && !file.includes('\\') && !file.split('/').includes('..'));
    const name = Buffer.from(file);
    const data = readFileSync(path.join(directory, file));
    const compressed = deflateRawSync(data, { level: 9 });
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(0x0021, 12);
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(compressed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(0x0314, 4);
    header.copy(entry, 6, 4, 30);
    entry.writeUInt32LE(0o100644 * 65536, 38);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += header.length + name.length + compressed.length;
    assert.ok(offset < 0xffffffff, 'ZIP64 is not supported');
  }
  const directoryData = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directoryData.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directoryData, end]);
}

// Verify both header tables, decompression, sizes, CRCs and original bytes.
export function verifyZip(archive, directory, files) {
  const end = archive.length - 22;
  assert.equal(archive.readUInt32LE(end), 0x06054b50, 'Missing ZIP end record');
  assert.equal(archive.readUInt16LE(end + 10), files.length);
  let cursor = archive.readUInt32LE(end + 16);
  const start = cursor;
  const found = [];
  for (let index = 0; index < files.length; index++) {
    assert.equal(archive.readUInt32LE(cursor), 0x02014b50, 'Invalid central directory');
    const size = archive.readUInt32LE(cursor + 20);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString();
    assert.ok(files.includes(name) && !found.includes(name), `Unexpected ZIP entry: ${name}`);
    found.push(name);
    const offset = archive.readUInt32LE(cursor + 42);
    assert.equal(archive.readUInt32LE(offset), 0x04034b50);
    assert.equal(archive.readUInt16LE(offset + 8), 8);
    assert.equal(archive.readUInt32LE(offset + 18), size);
    assert.equal(archive.readUInt16LE(offset + 26), nameLength);
    assert.equal(archive.subarray(offset + 30, offset + 30 + nameLength).toString(), name);
    const data = inflateRawSync(archive.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size));
    assert.equal(data.length, archive.readUInt32LE(cursor + 24));
    assert.equal(crc32(data), archive.readUInt32LE(cursor + 16), `CRC mismatch: ${name}`);
    assert.equal(crc32(data), archive.readUInt32LE(offset + 14));
    assert.deepEqual(data, readFileSync(path.join(directory, name)), `Archived bytes differ: ${name}`);
    cursor += 46 + nameLength;
  }
  assert.equal(cursor, end);
  assert.equal(cursor - start, archive.readUInt32LE(end + 12));
  assert.deepEqual(found.sort(), files.slice().sort());
  assert.ok(found.includes('manifest.json'), 'Manifest must be at the ZIP root');
}
