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

app.get('/',function (req, res) {
    if (firebase.auth().currentUser !== null) {
        res.redirect('/main');
    } else {
        res.redirect('/login');
    }
});

app.get('/main', function (req, res) {
    if (firebase.auth().currentUser === null)  res.redirect('/login');
    res.sendFile(path.join(__dirname, '../public', 'main.html'));
});

app.get('/login', function (req, res) {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.get('/qrcode', function (req, res) {
    if (firebase.auth().currentUser === null)  res.redirect('/login');
    res.sendFile(path.join(__dirname, '../public', 'qrcode.html'));
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
    firebase.database().ref('teachers/' + name + '/registeredLesson').on('value', function(snapshot){
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

app.post('/qrcode/print', function (req, res) {
    var code = req.body.code;
    var dateObj = new Date();
    var date = dateObj.getFullYear() + '-' + dateObj.getMonth() + '-' + dateObj.getDay();
    var qrCodeString = code + '_' + date;

    firebase.database().ref('lessons/' + code + '/' + date + '/active').set(false);
    var pixMat = buildQrCode(qrCodeString);

    res.end();
});

exports.app = functions.https.onRequest(app);

function buildQrCode(qrCodeString) {
    
}
