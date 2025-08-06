/* Functions for working with IndexedDB */

/*  
    function IDBworkflow
    Basic for InxedDB:
    - opens and checks for uppropriate version;
    - creates objectStore for dbtable

    Usage example:
    idbworkflow('db', 1, 'dbtable', 'readonly', store => {
        let somearray = []
        store.openCursor().addEventListener('success', e => {
            const cursor = e.target.result
            if(cursor){
                somearray.push(cursor.value)
                cursor.continue()
            }
        })
    })
 */
export function IDBworkflow(dbname, dbver, dbtable, mode, onsuccess, keyPath, autoIncrement = true) {

    console.log('IDBworkflow', dbname, dbver, dbtable, mode, onsuccess, keyPath, autoIncrement)
    const IDB = window.indexedDB || window.webkitIndexedDB
    if(!IDB) { return }

    let db = null
    const DBOpenReq = IDB.open(dbname, dbver)
    
    DBOpenReq.addEventListener('error', err => {
        console.warn(err)
    })

    DBOpenReq.addEventListener('success', e => {
        db = e.target.result;

        if(db.objectStoreNames.contains(dbtable)) {
            let tx = db.transaction(dbtable, mode);
            tx.addEventListener('error', err => {
                console.warn(err)
            })
            const store = tx.objectStore(dbtable)
            onsuccess(store)
        }
    })


    DBOpenReq.addEventListener('upgradeneeded', (e) => {
        db = e.target.result
            
        const oldVersion = e.oldVersion
        const newVersion = e.newVersion || db.version

        if(oldVersion === 0) {
            console.log('DB updated from version', oldVersion, 'to', newVersion);
        } else {
            IDBcleartable(dbname, dbver, dbtable);
            console.log('DB version is outdated, all data will be cleared for further compatible work');
        }

        if (!db.objectStoreNames.contains(dbtable)) {
            db.createObjectStore(dbtable, { keyPath, autoIncrement })
        }
    })
}

/* get all data from the table */
export function IDBgettable(dbname, dbver, dbtable, keyPath = 'id', autoIncrement = true) {
    return new Promise((resolve) => {
        let datafromtable = []
        IDBworkflow(dbname, dbver, dbtable, 'readonly', store => {
            store.openCursor().addEventListener('success', e => {
                const cursor = e.target.result
                if(cursor){
                    datafromtable.push(cursor.value)
                    cursor.continue()
                } else {
                    resolve(datafromtable)
                }
            })
        }, keyPath, autoIncrement)
    })
}


export function IDBdeleteByKey(dbname, dbver, dbtable, key) {
  return new Promise((resolve, reject) => {
    IDBworkflow(
      dbname,
      dbver,
      dbtable,
      "readwrite",
      (store) => {
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = (e) => reject(e);
      }
    );
  });
}

/* delete all data from the table */
export function IDBcleartable(dbname, dbver, dbtable) {

    IDBworkflow(dbname, dbver, dbtable, 'readwrite', store => {
        const request = store.clear();

        request.onsuccess = ()=> {
            console.log(`DB ${dbtable} cleared`);
            const bc = new BroadcastChannel('idb_changed');
            bc.postMessage(dbtable);
            bc.close();
            return true;
        }
    
        request.onerror = (err)=> {
            console.log(`Error to empty Object Store: ${err}`);
            return false;
        }
    });
    
}

/*  
    encryptText(text)
    Возвращает объект { ciphertext, iv, key }
    Используется для безопасного хранения текста
*/

export async function encryptText(text) {
    const MAGIC = "altruist-v1";
    const enc = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(`${MAGIC}:${text}`)
    );
    const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
    return {
        ciphertext: Array.from(new Uint8Array(ciphertext)),
        iv: Array.from(iv),
        key: exportedKey,
    };
}

/*
    decryptText(data)
    data — объект {ciphertext, iv, key}
    Возвращает расшифрованный текст или null, если ошибка
*/
export async function decryptText(data) {
    try {
        const MAGIC = "altruist-v1";
        const dec = new TextDecoder();
        const key = await window.crypto.subtle.importKey(
            "jwk",
            data.key,
            { name: "AES-GCM" },
            false,
            ["decrypt"]
        );
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(data.iv) },
            key,
            new Uint8Array(data.ciphertext)
        );
        const str = dec.decode(new Uint8Array(decrypted));
        if(str.startsWith(MAGIC + ":")) {
            return str.slice(MAGIC.length + 1);
        }
        return null;
    } catch(e) {
        return null;
    }
}