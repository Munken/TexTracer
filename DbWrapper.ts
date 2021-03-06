/// <reference path="PathComparator2.ts" />
/**
 * Created by Munk on 06-06-2014.
 */

module DbWrapper {

    var TABLE = "texDB";
    var OFFLINE = "offline?";
    var LAST_INDEX = "lastIndex";//
    var OBJ_STORE = "traces";
    var db;
    var dbWaiters = [];
    var dbCreated = false;


    export var offline = !!window.localStorage.getItem(OFFLINE);
    export var lastIdx = window.localStorage.getItem(LAST_INDEX);
    export var isDbSupported:boolean = "indexedDB" in window;

    export function wantOffline(b:boolean) {
        offline = b;
        window.localStorage.setItem(OFFLINE, b ? "TRUE" : "");

        console.log("Offline status switched to: " + b);

        if (!b) {
            deleteAll();
            setIndex(-1);
        }
    }

    export function setIndex(i : number) {
        lastIdx = i;
        window.localStorage.setItem(LAST_INDEX, ""+i);

        console.log("Updated index: " + i);
    }


    console.log("Initial offline status: " + offline);

    ensureDB();

    export function addBasis(samples : ServerSample2[]) {
        console.log("Adding basis!");
        waitWrap(function() {
            console.log("Adding elements!");
            var transaction = db.transaction(OBJ_STORE, "readwrite");
            var store = transaction.objectStore(OBJ_STORE);

            _.each(samples, function (x) {
                store.add(x)
            });

            transaction.oncomplete = function() {alert("Completo!");}
        });
    }

    export function addExtra(samples) {
        if (samples.length == 0) return;

        waitWrap(function() {
            console.log("Adding extra");
            var transaction = db.transaction(OBJ_STORE, "readwrite");
            var store = transaction.objectStore(OBJ_STORE);

            var max = -1;
            _.each(samples, function (nSample : any) {
                max = Math.max(max, nSample.i);
                console.log(nSample.c);
                store.get("" + nSample.c).onsuccess = function(e) {
                    var value= e.target.result;
                    value.s.push({x: nSample.x, y: nSample.y});
                };
            });


            transaction.oncomplete = function() {setIndex(Math.max(max, lastIdx));}
        });
    }

    export function cursor(fcn : (s: ServerSample2[]) => void) {
        waitWrap(function() {
            var transaction = db.transaction(OBJ_STORE, "readonly");
            var objectStore = transaction.objectStore(OBJ_STORE);

            var result = [];
            var cursor = objectStore.openCursor();
            cursor.onsuccess = function (e) {
                var res = e.target.result;
                if (res) {
                    result.push(res.value);
                    res.continue();
                }
                else {
                    console.log(result.length);
                    fcn(result);
                }
            }
        })
    }

    function waitWrap(fcn : () => void) {
        ensureDB();
        if (!!db) {
            fcn();
        } else {
            dbWaiters.push(fcn);
        }
    }

    function deleteAll() {
        if (!db) return;
        var store = db.transaction([OBJ_STORE], "readwrite")
            .objectStore(OBJ_STORE);

        store.clear();
    }

    function ensureDB() {
        if (dbCreated) return;

        if (!isDbSupported) alert("No DB support !");

        if (offline && isDbSupported) {
            dbCreated = true;
            var openRequest = indexedDB.open(TABLE, 2);

            openRequest.onupgradeneeded = function (e: any) {
                console.log("Upgrading...");
                var thisDB = e.target.result;
                if(!thisDB.objectStoreNames.contains(OBJ_STORE)) {
                    thisDB.createObjectStore(OBJ_STORE, { keyPath: "i" });
                }
            };

            openRequest.onsuccess = function (e : any) {
                console.log("Success!");
                db = e.target.result;

//                cursor(function(x) {alert(x.length)});

                _.each(dbWaiters, function(fcn) {fcn();});
            };

            openRequest.onerror = function (e) {
                console.log("Error");
                console.dir(e);

                alert("Arg fejl !");
            };

        }
    }
}