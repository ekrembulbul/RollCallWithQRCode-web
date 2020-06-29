const firebase = require('firebase');
const functions = require('firebase-functions');
const path = require("path");
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const rs = require('./reedsolomon.js');
const data = require('./data.json');
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

app.get('/dates', function (req, res) {
    if (firebase.auth().currentUser === null)  res.redirect('/login');
    else res.sendFile(path.join(__dirname, '../public', '/dates.html'));
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

app.post('/firebase/data/dates', function (req, res) {
    var lessonCode = req.body.lessonCode;
    firebase.database().ref('lessons/' + lessonCode + '/dates').once('value', function(snapshot){
        var weeks = {}
        snapshot.forEach(function(cSnapshot) {
            var week = cSnapshot.key;
            var dates = {}
            cSnapshot.forEach(function(ccSnapshot) {
                var date = ccSnapshot.key;
                var times = {};
                ccSnapshot.forEach(function(cccSnapshot) {
                    var time = cccSnapshot.key;
                    times[time] = cccSnapshot.child("done").val();
                });
                dates[date] = times;
            });
            weeks[week] = dates;  
        });
        time = JSON.stringify(weeks);
        console.log(time);
        res.send(time);
        res.end();
    });
});

app.post('/firebase/signout', function (req, res) {
    firebase.auth().signOut().then(function(){
        res.end();
    })
});

app.post('/qrcode/generate', function (req, res) {
    var lessonCodeString = req.body.lessonCodeString;
    var codeStr = buildQrCode(lessonCodeString);
    res.send({ qrCodeStr : codeStr});
    res.end();
});

app.post('/qrcode/active', function (req, res) {
    var lessonCodeString = req.body.lessonCodeString;
    var lesCodeStr = lessonCodeString.split(" ");
    console.log(lessonCodeString);

    firebase.database().ref('lessons/' + lesCodeStr[1] + '/dates/' + lesCodeStr[2] + "/" + lesCodeStr[3] + "/" + lesCodeStr[4] + '/active').once('value', function(snapshot){
        var activeVal = snapshot.val();
        console.log(activeVal);
        if (activeVal== null) {
            firebase.database().ref('lessons/' + lesCodeStr[1] + '/dates/' + lesCodeStr[2] + "/" + lesCodeStr[3] + "/" + lesCodeStr[4] + '/active').set(false).then(function(){
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

    firebase.database().ref('lessons/' + lesCodeStr[1] + '/dates/' + lesCodeStr[2] + "/" + lesCodeStr[3] + "/" + lesCodeStr[4] + '/active').set(active).then(function(){
        res.end();
    });
});

app.post('/qrcode/active/done', function (req, res) {
    var lessonCodeString = req.body.lessonCodeString;
    var lesCodeStr = lessonCodeString.split(" ");

    var code = lesCodeStr[1];
    var week = lesCodeStr[2];
    var date = lesCodeStr[3];
    var time = lesCodeStr[4];

    firebase.database().ref('lessons/' + code + '/dates/' + week + "/" + date + "/" + time + '/done').once('value', function(snapshot){
        if (snapshot.val() === true) res.end();
    });

    firebase.database().ref('lessons/' + code + '/dates/' + week + "/" + date + "/" + time + '/done').set(true).then(function(){
        
        firebase.database().ref('lessons/' + code + '/dates/' + week + "/" + date + "/" + time + "/status").once('value', function(snapshot){
            snapshot.forEach(function(cSnapshot) {
                if (cSnapshot.val() == 0) {
                    firebase.database().ref('lessons/' + code + '/dates/' + week + "/" + date + "/" + time + "/status/" + cSnapshot.key).set(-1);
                }
            });
            res.end();
        });
    });
});

app.post('/sendemail', function (req, res) {
    var lessonCodeString = req.body.lessonCodeString;
    var lesCodeStr = lessonCodeString.split(" ");

    var code = lesCodeStr[1];
    var week = lesCodeStr[2];
    var date = lesCodeStr[3];
    var time = lesCodeStr[4];

    firebase.database().ref('students').once('value', function(snapshot){
        snapshot.forEach(function(cSnapshot) {
            var flag = false;
            cSnapshot.child("registeredLesson").forEach(function(ccSnapshot) {
                console.log("code = " + ccSnapshot.val());
                if (ccSnapshot.val() === code) {
                    flag = true;
                    console.log("flag = true");
                }
            });
            if (flag) {
                if (cSnapshot.child("status").child(code).child(week).child(date).child(time).val() == 0) {
                    firebase.database().ref('students/' + cSnapshot.key + "/status/" + code + '/' + week + "/" + date + "/" + time).set(-1);
                }
            }
        });
        checkAndSendEmail(res, code, week, date, time);
    });
});

exports.app = functions.https.onRequest(app);

function checkAndSendEmail(res, code, week, date, time) {
    var studentList = []

    firebase.database().ref('lessons/' + code + '/dates/' + week + "/" + date + "/" + time + '/status').once('value', function(snapshot){
        snapshot.forEach(function(cSnapshot) {
            if (cSnapshot.val() === -1) studentList.push(cSnapshot.key);
        });0

        firebase.database().ref('students').once('value', function(snapshot) {
            studentList.forEach(function(student) {
                var sum = 0;
                var failed = 0;

                snapshot.child(student).child("status").child(code).forEach(function(cSnapshot) {
                    cSnapshot.forEach(function(ccSnapshot) {
                        ccSnapshot.forEach(function(cccSnapshot) {
                            sum++;
                            if (cccSnapshot.val() === -1) failed++;
                        });
                    });
                });

                var failedTimeNumberFloat = sum * 3 / 10;
                var failedTimeNumber = Math.floor(failedTimeNumberFloat);
                failedTimeNumber++;
                console.log("failedTimeNumber: " + failedTimeNumber);

                if (failed >= failedTimeNumber) {
                    var error = false;
                    dbError = snapshot.child(student).child("email").child("error").child(code).val();
                    if (dbError !== null) error = dbError;
    
                    if (!error) {
                        sendEmail(code, student, "error", 0);
                        firebase.database().ref('students/' + student + '/email/error/' + code).set(true);
                    }
                }
                else if (failed < failedTimeNumber && failed >= failedTimeNumber - 6) {
                    var warning = false;
                    dbWarning = snapshot.child(student).child("email").child("warning").child(code).val();
                    if (dbWarning !== null) warning = dbWarning;
    
                    if (!warning) {
                        sendEmail(code, student, "warning", failedTimeNumber - failed);
                        firebase.database().ref('students/' + student + '/email/warning/' + code).set(true);
                    }
                }
            });
            res.end();
        });
    });
}

function sendEmail(code, studentId, type, remainingTime) {
    console.log("email sent " + type);
    let testAccount = nodemailer.createTestAccount();

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'ekrem.bulbul.52@gmail.com',
            pass: '199773898814e'
        }
    });

    var email = null;
    firebase.database().ref('users/students').once('value', function(snapshot){
        snapshot.forEach(function(cSnapshot) {
            console.log(cSnapshot.child("sId").val() + ", " + studentId);
            if (cSnapshot.child("sId").val() == studentId) {
                email = cSnapshot.child("email").val();

                console.log("email: " + email);

                if (type === "warning") {
                    var mailOptions = {
                        from: 'ekrem.bulbul.52@gmail.com',
                        to: email,
                        subject: 'Information for the course ' + code,
                        text: 'Hello ' + studentId + ',\n\nIf you do not attentd the ' + code + ' lecture ' + remainingTime + ' more hours, you will fail.\n\nThank you.'
                    };
                }
                else if (type === "error") {
                    var mailOptions = {
                        from: 'ekrem.bulbul.52@gmail.com',
                        to: email,
                        subject: 'Information for the course ' + code,
                        text: 'Hello ' + studentId + ',\n\nYou have failed the ' + code + ' lecture.\n\nThank you.'
                    };
                }
                
                transporter.sendMail(mailOptions, function(error, info){
                    if (error) {
                        console.log(error);
                    } else {
                        console.log('Email sent: ' + info.response);
                    }
                });
            }
        });
    });

    
}

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

function RS(messageLength, errorCorrectionLength) {
	var dataLength = messageLength - errorCorrectionLength;
	var encoder = new rs.ReedSolomonEncoder(rs.GenericGF.AZTEC_DATA_8());
	var decoder = new rs.ReedSolomonDecoder(rs.GenericGF.AZTEC_DATA_8());
	return {
		dataLength: dataLength,
		messageLength: messageLength,
		errorCorrectionLength: errorCorrectionLength,

		encode : function (message) {
			encoder.encode(message, errorCorrectionLength);
		},

		decode: function (message) {
			decoder.decode(message, errorCorrectionLength);
		}
	};
}

function errorCodeWordEncode(codeWord, length) {
    var zeros = new Array(length).fill(0);
    var arr = codeWord;
    arr = arr.concat(zeros);
    console.log(arr.length);
    console.log(arr);
    
    var ec = RS(codeWord.length + length, length);
    var message = new Int32Array(ec.messageLength);
    //for (var i = 0; i < ec.dataLength; i++) message[i] = i;
    message.set(arr);

    console.log('raw data');
    console.log(Array.prototype.join.call(message));
    //=> 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,0,0,0,0,0,0,0

    ec.encode(message);

    console.log('rs coded');
    console.log(Array.prototype.join.call(message));
    //=> 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,180,183,0,112,111,203,47,126

    return Array.from(message);

    /*
    console.log('corrupted');
    for (var i = 0; i < 4; i++) message[ Math.floor(Math.random() * message.length) ] = 0xff;
    console.log(Array.prototype.join.call(message));
    //=> 0,1,2,3,4,255,6,7,8,9,10,11,12,13,14,15,255,17,18,19,20,21,22,23,255,183,255,112,111,203,47,126

    ec.decode(message);

    console.log('rs decoded');
    console.log(Array.prototype.join.call(message));
    //=> 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,180,183,0,112,111,203,47,126
    */
}

function buildQrCode(lesCodeStr) {
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

    var codeWordList = [];
    for (let i = 0; i < qrCodeStr.length/8; i++) {
        var num = parseInt(qrCodeStr.substr(i*8, 8), 2);
        codeWordList.push(num);
    }
    console.log(codeWordList);
    console.log(typeof codeWordList);
    console.log(codeWordList.length);

    codeWordList = errorCodeWordEncode(codeWordList, 22);
    console.log(codeWordList);
    console.log(typeof codeWordList);
    console.log(codeWordList.length);

    qrCodeStr = '';
    codeWordList.forEach(element => {
        qrCodeStr += fillZeros(8, element.toString(2));
    });
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    qrCodeStr += '0'.repeat(7);
    console.log(qrCodeStr);
    console.log(qrCodeStr.length);

    return qrCodeStr;
}
