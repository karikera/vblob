"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tmp = require("tmp");
const fs = require("fs");
const EventTarget = require('eventtarget');
function getTempPath() {
    return new Promise((resolve, reject) => {
        tmp.tmpName((err, path) => {
            if (err)
                reject(err);
            else {
                tempFiles.add(path);
                resolve(path);
            }
        });
    });
}
function fdopen(path, flags) {
    return new Promise((resolve, reject) => fs.open(path, flags, (err, fd) => {
        if (err)
            reject(err);
        else
            resolve(fd);
    }));
}
function fdclose(fd) {
    return new Promise((resolve, reject) => fs.close(fd, err => {
        if (err)
            reject(err);
        else
            resolve();
    }));
}
function fdwriteFile(fd, path) {
    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(null, { fd });
        const reader = fs.createReadStream(path);
        reader.on('error', reject);
        reader.on('end', resolve);
        writer.on('error', reject);
        reader.pipe(writer, { end: false });
    });
}
function fdwrite(fd, str) {
    return new Promise((resolve, reject) => fs.write(fd, str, (err) => {
        if (err)
            reject(err);
        else
            resolve();
    }));
}
function fdread(fd, size, position) {
    const buffer = Buffer.alloc(size);
    return new Promise((resolve, reject) => fs.read(fd, buffer, 0, size, position, (err) => {
        if (err)
            reject(err);
        else
            resolve(buffer);
    }));
}
const tempFiles = new Set;
const onExit = [];
process.on('exit', code => {
    for (const cb of onExit)
        cb();
    process.exit(code);
});
onExit.push(() => {
    for (const file of tempFiles) {
        fs.unlinkSync(file);
    }
});
class VBlob {
    constructor(array, options) {
        this._path = '';
        this._offset = 0;
        this._writeTask = Promise.resolve(0);
        this._type = (options && options.type) || '';
        if (!array) {
            this._path = '';
            this._size = 0;
        }
        else {
            var size = 0;
            for (const value of array) {
                if (value instanceof ArrayBuffer) {
                    if (value.byteLength === 0)
                        continue;
                    this._write(fd => fdwrite(fd, new Uint8Array(value)));
                    size += value.byteLength;
                }
                else if (value instanceof Uint8Array) {
                    if (value.byteLength === 0)
                        continue;
                    this._write(fd => fdwrite(fd, value));
                    size += value.byteLength;
                }
                else if ((value instanceof Int8Array) ||
                    (value instanceof Uint8ClampedArray) ||
                    (value instanceof Int16Array) ||
                    (value instanceof Uint16Array) ||
                    (value instanceof Int32Array) ||
                    (value instanceof Uint32Array) ||
                    (value instanceof Float32Array) ||
                    (value instanceof Float64Array) ||
                    (value instanceof DataView)) {
                    if (value.byteLength === 0)
                        continue;
                    this._write(fd => fdwrite(fd, new Uint8Array(value.buffer, value.byteOffset, value.byteLength)));
                    size += value.byteLength;
                }
                else if (value instanceof VBlob) {
                    if (value._size === 0)
                        continue;
                    this._write(fd => fdwriteFile(fd, value._path));
                    size += value._size;
                }
                else {
                    const str = value + '';
                    if (str.length === 0)
                        continue;
                    this._write(fd => fdwrite(fd, str));
                    size += str.length;
                }
            }
            this._writeEnd();
            this._size = size;
        }
    }
    _write(fn) {
        this._writeTask = this._writeTask.then((fd) => __awaiter(this, void 0, void 0, function* () {
            if (!fd) {
                this._path = yield getTempPath();
                fd = yield fdopen(this._path, 'w+');
            }
            yield fn(fd);
            return fd;
        }));
    }
    _writeEnd() {
        this._writeTask = this._writeTask.then(fd => fdclose(fd)).then(() => 0);
    }
    get size() {
        return this._size;
    }
    get type() {
        return this._type;
    }
    slice(start, end, contentType) {
        if (!start)
            start = 0;
        else if (start < 0)
            start = this._size + start;
        if (!end)
            end = this._size;
        if (end < 0)
            end = this._size - end;
        else if (end >= this._size)
            end = this._size;
        if (start >= end)
            return new VBlob([]);
        const newblob = new VBlob();
        newblob._type = contentType || this._type;
        newblob._writeTask = this._writeTask;
        newblob._offset = this._offset + start;
        newblob._size = end - start;
        this._writeTask.then(() => newblob._path = this._path);
        return newblob;
    }
    readBuffer(fd) {
        return fdread(fd, this._size, this._offset).then(buffer => buffer.buffer);
    }
}
exports.Blob = global['Blob'] || VBlob;
class VFileReader extends EventTarget {
    constructor() {
        super();
        this._workCount = 0;
        this._abort = null;
        this._abortPromise = null;
        this._readyState = 0;
    }
    get readyState() {
        return this._readyState;
    }
    abort() {
        this._readyState = 2;
        if (this._abort) {
            this._abort(null);
            this._abort = null;
            this._abortPromise = null;
        }
        this.dispatchEvent({ type: 'abort' });
    }
    _readBuffer(blob, cb) {
        return __awaiter(this, void 0, void 0, function* () {
            var data;
            try {
                if (this._workCount === 0) {
                    this.dispatchEvent({ type: 'loadstart' });
                }
                this._workCount++;
                if (blob._size === 0) {
                    data = Buffer.alloc(0);
                    this.result = cb(data);
                    this.dispatchEvent({ type: 'load' });
                    return;
                }
                this._readyState = 1;
                if (!this._abortPromise) {
                    this._abortPromise = new Promise(resolve => {
                        this._abort = resolve;
                    });
                }
                data = yield Promise.race([this._abortPromise, (() => __awaiter(this, void 0, void 0, function* () {
                        yield blob._writeTask;
                        const fd = yield fdopen(blob._path, 'r');
                        try {
                            return yield fdread(fd, blob._size, blob._offset);
                        }
                        finally {
                            fdclose(fd);
                        }
                    }))()]);
                if (data) {
                    this.result = cb(data);
                    this.dispatchEvent({ type: 'load' });
                }
            }
            catch (err) {
                this.error = err;
                this.dispatchEvent({ type: 'error', message: err ? err.message : "Error" });
            }
            finally {
                this._readyState = 2;
                this._workCount--;
                if (this._workCount === 0) {
                    if (data !== null) {
                        this.dispatchEvent({ type: 'loadend' });
                    }
                }
            }
        });
    }
    readAsArrayBuffer(blob) {
        if (!(blob instanceof VBlob))
            throw Error('Only for VBlob');
        this._readBuffer(blob, data => data.buffer);
    }
    readAsBinaryString(blob) {
        if (!(blob instanceof VBlob))
            throw Error('Only for VBlob');
        this._readBuffer(blob, data => data.toString('binary'));
    }
    readAsDataURL(blob) {
        if (!(blob instanceof VBlob))
            throw Error('Only for VBlob');
        this._readBuffer(blob, data => "data:" + blob._type + ";base64," + data.toString('base64'));
    }
    readAsText(blob) {
        if (!(blob instanceof VBlob))
            throw Error('Only for VBlob');
        this._readBuffer(blob, data => data.toString());
    }
}
exports.FileReader = global['FileReader'] || VFileReader;
//# sourceMappingURL=index.js.map