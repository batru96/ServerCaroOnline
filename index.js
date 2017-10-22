const express = require('express');
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const md5 = require('md5');
const mysql = require('mysql');

const app = express();
app.use(express.static('./public'));
app.set('view engine', 'ejs');
app.set('views', './views');
server.listen(3000, () => console.log('server is running'));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'CaroGame'
});
const jsonParser = bodyParser.json();
const roomOnlineName = 'USER_ONLINE';

app.get('/', (req, res) => {
    res.render('trangchu.ejs');
});

connection.connect(err => {
    if (err) {
        console.log(`Error: ${err.message}`);
        return;
    }
    console.log('CONNECTED DATABASE!!!');

    app.post('/dangky', jsonParser, (req, res) => {
        if (!req.body) return res.sendStatus(400);
        const { email, name, password } = req.body;
        const query = `INSERT INTO USERS(email, name, password) VALUES ('${email}', '${name}', '${md5(password)}')`;
        connection.query(query, error => {
            if (error) {
                res.send('THAT_BAI');
            } else {
                res.send('THANH_CONG');
            }
        });
    });

    const dsOnline = [];
    io.on('connection', socket => {
        console.log('CO NGUOI KET NOI');

        socket.on('USER_SEND_DANG_NHAP', data => {
            const { email, password } = data;
            const query = `SELECT email, name, is_sign_in FROM USERS WHERE email = '${email}' AND password = '${md5(password)}'`;
            connection.query(query, (error, result) => {
                if (error) {
                    console.log(`Error: ${error.message}`);
                } else {
                    const arr = JSON.parse(JSON.stringify(result));
                    if (arr.length === 0) {
                        // Sai thông tin đăng nhập.
                        socket.emit('SERVER_SEND_DANG_NHAP_THAT_BAI', 'TK_KHONG_HOP_LE');
                    } else {
                        // Thông tin đăng nhập chính xác.
                        const { name, is_sign_in } = arr[0];
                        if (is_sign_in === 1) {
                            // Tài khoản đã được đăng nhập trước đó.
                            socket.emit('SERVER_SEND_DANG_NHAP_THAT_BAI', 'TK_DA_DANG_NHAP_BOI_NGUOI_DUNG_KHAC');
                            return;
                        }

                        // Đăng nhập thành công.
                        // Gán email và name vào cho socket
                        socket.email = email;
                        socket.name = name;

                        // Cập nhật trạng thái của user.
                        const queryUpdate = `UPDATE USERS SET is_sign_in = 1 WHERE email = '${email}'`;
                        connection.query(queryUpdate, (err, result) => {
                            if (err) {
                                console.log(`Error: ${err.message}`);
                                return;
                            }
                        });

                        // Thêm user mới vào mảng user đang online.
                        dsOnline.push({ email, name, id: socket.id });
                        socket.emit('SERVER_SEND_DANG_NHAP_THANH_CONG', dsOnline);
                        // Thông báo có người đăng nhập đến các user đang online, kèm theo ds user mới.
                        socket.broadcast.to(roomOnlineName).emit('SERVER_SEND_DS_USERS_ONLINE', dsOnline);
                        // Join vào room chứa các socket đã đăng nhập.
                        socket.join(roomOnlineName);
                    }
                }
            });
        });

        socket.on('USER_SEND_THACH_DAU', id => {
            const room = `ROOM_ ${socket.id}`;
            socket.join(room);
            socket.broadcast.to(id).emit('SERVER_SEND_THACH_DAU', {
                id: socket.id, 
                name: socket.name, 
                room
            });
        });

        socket.on('USER_SEND_REPLY', data => {
            const { id, result, room } = data;
            if (result === 'YES') {
                socket.join(room);
            }
            socket.broadcast.to(id).emit('SERVER_SEND_REPLY', { result, room });
        });

        socket.on('USER_A_LEAVES_ROOM', room => {
            console.log(room);
            socket.leave(room);
            socket.broadcast.to(room).emit('SERVER_SEND_LEAVE_ROOM', room);
        });

        socket.on('USER_B_LEAVES_ROOM', room => socket.leave(room));

        socket.on('USER_SEND_DANG_XUAT', () => {
            dangXuat(socket);
        });

        socket.on('disconnect', () => {
            console.log('CO NGUOI NGAT KET NOI: ' + socket.id);
        });
    });
});
