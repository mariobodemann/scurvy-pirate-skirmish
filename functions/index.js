const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);


// constants
const number_of_ships = 5;
const max_hits = 3;

// create/reconnect
//
// in: uuid: {UUID}
// out: {status: new|old, x:, y:}
exports.moinMoin = functions.https.onRequest((request, response) => {
    const uuid = request.query.uuid;
    if (!uuid) {
        response.status(500).send('No valid UUID given!');
    }

     admin.database().ref('ships/' + uuid).once('value', function(snapshot) {
        if (!snapshot.val()) {
            new_position().then(function (position) {
                // new user!
                var user = {
                    uuid: uuid,
                    ship_model: uuid_number(uuid) % number_of_ships,
                    bullets_hit: 0,
                    kills: 0,
                    position: position,
                    direction: 'N'
                }

                admin.database().ref('ships').child(uuid).set(user, function(error){
                    if (error) {
                        console.log(error);
                        response.response(500).send('Error while creating uuid');
                    } else {
                        response.send(JSON.stringify({status: 'new', user:user}));
                    }
                });
            });
        } else {
            response.send(JSON.stringify({status: 'existing', user:snapshot.val()}));
        }
    });
});

exports.list = functions.https.onRequest((request,response) => {
     admin.database().ref('ships/').once('value', function(snapshot) {
        response.send(JSON.stringify(snapshot.val()));
    });
});

// move a ship 
//
// in:  direction=[n|s|e|w]
//      uuid={UUID}
// out: {status:okay} -> moveable
//      {status:blocked} -> blocked
exports.move = functions.https.onRequest((request, response) => {
    const uuid = request.query.uuid;
    if (!uuid) {
        response.status(500).send('No valid UUID given!');
    }
    const direction = request.query.direction;
    if (!direction) {
        response.status(500).send('No direction given!');
    }
    if (direction.length != 1 && "nsew".includes(direction)) {
        response.status(500).send('Given direction is wrong!');
    }

    admin.database().ref('ships/' + uuid).once('value', function(snapshot) {
        const ship = snapshot.val();
        if (!ship) {
            response.status(500).send("No valid ship uuid given!");
        }

        var x = ship.position.x;
        var y = ship.position.y;

        switch (direction) {
        case 'n':
            y += 1;
            break;
        case 's':
            y -= 1;
            break;
        case 'e':
            x += 1;
            break;
        case 'w':
            x -= 1;
            break;
        }

         admin.database().ref('ships/').once('value', function(snapshot) {
            var tile_occupied = false;
             for (i in snapshot.val()) {
                 var other = snapshot.val()[i];
                 
                 if (other.uuid != uuid && other.position.x === x && other.position.y === y) {
                     console.log(uuid + ' is blocked by ' + other.uuid);
                     tile_occupied = true;
                     break;
                 }
             }
             
             if (tile_occupied) {
                response.send(JSON.stringify({status: 'blocked'}));
             } else {
                ship.position.x = x;
                ship.position.y = y;

                console.log(JSON.stringify(ship));

                admin.database().ref('ships').child(uuid).set(ship, function(error){
                    if (error) {
                        console.log(error);
                        response.send(JSON.stringify({status: 'something went wrong'}));
                    } else {
                        response.send(JSON.stringify({status: 'okay'}));
                    }
                });
            }
        });
    });
});

// shoot 90 degree to direction
//
// in: uuid:
//     direction:n|s|e|w
// out: {status: hit|water}
exports.shoot = functions.https.onRequest((request, response) => {
    const uuid = request.query.uuid;
    if (!uuid) {
        response.status(500).send('No valid UUID given!');
    }

    admin.database().ref('ships/' + uuid).once('value', function(snapshot) {
        const ship = snapshot.val();

        admin.database().ref('ships/').once('value', function(snapshot) {
            var ships = snapshot.val();

            var hit = false;
            var hitTarget = null;
            for (var i in ships) {
                var target = ships[i];

                if (target.uuid == ship.uuid) {
                    continue;
                }

                switch(ship.direction) {
                    case 'n':
                    case 's':
                        if (target.position.y == ship.position.y) {
                            if (Math.abs(target.position.x - ship.position.x) == 1) {
                                // hit!
                                hit = true;
                                hitTarget = target;
                                break;
                            }
                        }
                    break;
                    case 'e':
                    case 'w':
                    break;
                }

                if (hit) {
                    hitTarget.bullets_hit ++;
                    if (hitTarget.bullets_hit > max_hits) {
                        admin.database().ref('ships').child(hitTarget.uuid).set(null);
                        ship.kills += 1;
                        admin.database().ref('ships').child(ship.uuid).set(ship);
                        response.send('hit');
                    }
                } else {
                    response.send('no hit');
                }
            }
        });
    });
});


// create a number from a string
//
function uuid_number(uuid) {
    sum=0;
    for (var i in uuid) { 
        sum += uuid[i].codePointAt(0); 
    }
    return sum;
}

function new_position() {
    console.log('entry');
    return new Promise((resolve,reject) => {
         admin.database().ref('ships/').once('value', function(snapshot) {
            console.log('ships found');
            if (!snapshot.val()) {
                console.log('first');
                resolve({x:0,y:0});
            } else {
                console.log('not first');
                var ships = snapshot.val();
                var min = [Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER];
                var max = [Number.MIN_SAFE_INTEGER,Number.MIN_SAFE_INTEGER];

                for (var index in ships) {
                    var ship = ships[index];

                    max[0] = Math.max(max[0], ship.position.x);
                    max[1] = Math.max(max[1], ship.position.y);
                    min[0] = Math.min(min[0], ship.position.x);
                    min[1] = Math.min(min[1], ship.position.y);
                }

                max[0] += 2;
                max[1] += 2;
                min[0] -= 2;
                min[1] -= 2;

                console.log('min ' + JSON.stringify(min));
                console.log('max ' + JSON.stringify(max));

                var w = max[0] - min[0];
                var h = max[1] - min[1];

                var tile_occupied = false;
                var x;
                var y;
                do {
                    x = Math.floor((Math.random() * w)) + min[0];
                    y = Math.floor((Math.random() * h)) + min[1];

                    console.log('candidate ' + JSON.stringify([x,y]));

                    // iterate on whether the tile is free
                    for (var index in ships) {
                        var ship = ships[index];

                        if ((ship.position.x === x) && (ship.position.y === y)) {
                            tile_occupied = true;
                            break;
                        }
                    }
                } while(tile_occupied);

                resolve({x:x,y:y});
            }
        });
    });
}
