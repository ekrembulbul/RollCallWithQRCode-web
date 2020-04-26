const firebase = require('firebase');
const functions = require('firebase-functions');
const path = require("path");
const express = require('express');
var bodyParser = require('body-parser')
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const config = {
    apiKey: "AIzaSyAH9FBFyQOPLsNqKsOuqH0PCFjrEe9_QB0",
    authDomain: "seniorproject-eaec8.firebaseapp.com",
    databaseURL: "https://seniorproject-eaec8.firebaseio.com",
    storageBucket: "seniorproject-eaec8.appspot.com"
};
firebase.initializeApp(config);

app.get('/lesson', function (req, res) {
    if (firebase.auth().currentUser === null)  res.redirect('/login');
    else res.sendFile(path.join(__dirname, '../public', '/lesson.html'));
});

app.get('/login', function (req, res) {
    res.sendFile(path.join(__dirname, '../public', '/login.html'));
});

app.get('/qrcode', function (req, res) {
    if (firebase.auth().currentUser === null)  res.redirect('/login');
    else res.sendFile(path.join(__dirname, '../public', '/qrcode.html'));
});

app.post('/login/check', function (req, res) {
    var email = req.body.email;
    var password = req.body.password;

    firebase.auth().signInWithEmailAndPassword(email, password).then(function(){
        if (firebase.auth().currentUser.emailVerified) {
            var validTeacher = false;
            firebase.database().ref("/users/teachers").once('value', function(snapshot) {
                snapshot.forEach(function(childSnapshot) {
                    console.log(childSnapshot.val().email);
                    console.log(email);
                    if (email == childSnapshot.val().email) {
                        validTeacher = true;
                        return;
                    }
                });
            }).then(function(){
                if (validTeacher) {
                    res.send({ result: true, message: '' });
                    res.end();
                } else {
                    res.send({ result: false, message: 'This user is not a teacher!' });
                    firebase.auth().signOut().then(function(){
                        res.end();
                    })
                }
            });
        } else {
            res.send({ result: false, message: 'Account not verified!' });
            firebase.auth().signOut().then(function(){
                res.end();
            })
        }
    }).catch(function(error){
        res.send({ result: false, message: 'Email or password incorrect!' });
        res.end();
    });
});

app.post('/firebase/data', function (req, res) {
    var lessons = {}
    var name = firebase.auth().currentUser.displayName;
    firebase.database().ref('teachers/' + name + '/registeredLesson').once('value', function(snapshot){
        snapshot.forEach(function(childSnapshot) {
            var childKey = childSnapshot.key;
            var childData = childSnapshot.val();
            lessons[childKey] = childData;  
        });
        lessons = JSON.stringify(lessons);
        console.log(lessons);
        res.send(lessons);
        res.end();
    });
});

app.post('/firebase/signout', function (req, res) {
    firebase.auth().signOut().then(function(){
        res.end();
    })
});

app.post('/qrcode/active', function (req, res) {
    var lessonCodeString = req.body.lessonCodeString;
    var lesCodeStr = lessonCodeString.split(" ");
    console.log(lessonCodeString);

    firebase.database().ref('lessons/' + lesCodeStr[1] + '/dates/' + lesCodeStr[2] + '/active').once('value', function(snapshot){
        var activeVal = snapshot.val();
        console.log(activeVal);
        if (activeVal== null) {
            firebase.database().ref('lessons/' + lesCodeStr[1] + '/dates/' + lesCodeStr[2] + '/active').set(false).then(function(){
                res.send({ active: false });
                res.end();
            });
        }
        else {
            res.send({ active: activeVal });
            res.end();
        }
    });
});

app.post('/qrcode/active/toggle', function (req, res) {
    var lessonCodeString = req.body.lessonCodeString;
    var lesCodeStr = lessonCodeString.split(" ");
    var active = req.body.active;

    firebase.database().ref('lessons/' + lesCodeStr[1] + '/dates/' + lesCodeStr[2] + '/active').set(active).then(function(){
        res.end();
    });
});

exports.app = functions.https.onRequest(app);



function fillZeros(length, str) {
    return '0'.repeat(length-str.length) + str;
}

function codding(lesCodeStr) {
    var lesCodeGroupStr = [];
    for (let i = 0; i < lesCodeStr.length/2; i++) {
        lesCodeGroupStr.push(lesCodeStr.substr(i*2, 2));
    }

    qrCodingStr = "";
    lesCodeGroupStr.forEach(element => {
        if (element.length == 2) {
            var tmp = (45 * data[element[0]]) + data[element[1]];
            var str = tmp.toString(2);
            qrCodingStr += fillZeros(11, str);
        }
        else if (element.length == 1) {
            var str = data[element[0]].toString(2);
            qrCodingStr += fillZeros(6, str);
        }
    });

    return qrCodingStr;
}

function buildQrCode(lesCodeStr) {
    var lesCodeStr = 'HELLO WORLD'
    var qrCodeStr = '0010';
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    var charLengthBinStr = lesCodeStr.length.toString(2);
    qrCodeStr = qrCodeStr + fillZeros(9, charLengthBinStr);
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    qrCodeStr += codding(lesCodeStr);
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    if (qrCodeStr.length == 175) {
        qrCodeStr += '0';
    }
    else if (qrCodeStr.length == 174) {
        qrCodeStr += '0'.repeat(2);
    }
    else if (qrCodeStr.length == 173) {
        qrCodeStr += '0'.repeat(3);
    }
    else if (qrCodeStr.length <= 172) {
        qrCodeStr += '0'.repeat(4);
    }
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    if (qrCodeStr.length % 8 != 0) {
        qrCodeStr += '0'.repeat(8 - (qrCodeStr.length % 8));
    }
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    padStr = ['11101100', '00010001'];
    if (qrCodeStr.length != 176) {
        var pedByteCount = (176 - qrCodeStr.length) / 8;
        for (let i = 0; i < pedByteCount; i++) {
            if (i % 2 == 0) qrCodeStr += padStr[0];
            else if (i % 2 == 1) qrCodeStr += padStr[1];
        }
    }
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    var rs = new ReedSolomon(10);
    var enc = rs.encode([14, 531, 46, 134 ,64]);
    console.log(enc);
}
