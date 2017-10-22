//region Will Open later
const express = require('express');

const app = express();
const bodyParser = require('body-parser');
const server = require('http').Server(app);
const io = require('socket.io')(server);
const md5 = require('md5');
const mysql = require('mysql');

app.use(express.static('./public'));
app.set('view engine', 'ejs');
app.set('views', './views');
server.listen(3000, () => console.log('server is running'));

const jsonParser = bodyParser.json();

app.get('/', (request, response) => {
    response.render('trangchu');
});
//endregion

//region Constants
let dsOnline = [];
const world = 'ROOM_ONLINE';
//endregion

//region Methods
function connectDatabase() {
    return mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'CaroGame'
    });
}

function leaveRoom(socket) {
    const { room } = socket;
    // Kiểm tra user có đang chơi hay không. Nếu có thì rời khỏi phòng.
    if (room !== undefined) {
        socket.leave(room, err => {
            if (!err) socket.broadcast.to(room).emit('USER_A_LEFT_ROOM');
        });
        socket.room = undefined;
    }
}

function leaveWorld(socket) {
    const { email } = socket;
    socket.leave(world, err => {
        if (!err) {
            dsOnline = dsOnline.filter(e => {
              if (e.email !== email) return e;
            });
            socket.broadcast.to(world).emit('SERVER_SEND_DS_USERS_ONLINE', dsOnline);
            socket.email = undefined;
            socket.name = undefined;
        }
    });
    const connection = connectDatabase();
    const query = `UPDATE USERS SET is_sign_in = 0 WHERE email = '${email}'`;
    connection.query(query, err => {
        if (err) console.log(err.message);
        connection.end();
    });

}

function dangXuat(socket) {
    leaveRoom(socket);
    leaveWorld(socket);
}
//endregion

//region DangKy
app.post('/dangky', jsonParser, (request, response) => {
    if (!request.body) {
        response.send('THAT_BAI');
    } else {
        const connecttion = connectDatabase();
        const { email, name, password } = request.body;
        const query = `INSERT INTO USERS(email, name, password) VALUES
        ('${email}', '${name}', '${md5(password)}')`;
        connecttion.query(query, err => {
            if (err) response.send(err.code);
            else response.send('THANH_CONG');
            connecttion.end();
        });
    }
});
//endregion

//region SocketIO
io.on('connection', socket => {
    console.log(`CO NGUOI KET NOI ${socket.id}`);
    socket.on('USER_SEND_DANG_NHAP', data => {
        const connection = connectDatabase();
        const { email, password } = data;
        const query = `
        SELECT email, name, is_sign_in as isSignIn
        FROM USERS
        WHERE email = '${email}' AND password = '${md5(password)}'`;
        connection.query(query, (error, result) => {
            if (error) {
                console.log(`Error: ${error.message}`);
            } else {
                const arr = JSON.parse(JSON.stringify(result));
                if (arr.length === 0) {
                    // Sai thông tin đăng nhập.
                    socket.emit('SERVER_SEND_DANG_NHAP_THAT_BAI',
                        'Email hoặc mật khẩu không hợp lệ.');
                } else {
                    // Thông tin đăng nhập chính xác.
                    const { name, isSignIn } = arr[0];
                    if (isSignIn === 1) {
                        // Tài khoản đã được đăng nhập trước đó.
                        socket.emit('SERVER_SEND_DANG_NHAP_THAT_BAI',
                            'Tài khoản đã được đăng nhập trên thiết bị khác.');
                    } else {
                        // Đăng nhập thành công.
                        // Gán email và name vào cho socket
                        socket.email = email;
                        socket.name = name;

                        // Cập nhật trạng thái của user.
                        const queryUpdate = `
                        UPDATE USERS
                        SET is_sign_in = 1
                        WHERE email = '${email}'`;
                        connection.query(queryUpdate);

                        // Thêm user mới vào mảng user đang online.
                        dsOnline.push({ email, name, id: socket.id });
                        socket.emit('SERVER_SEND_DANG_NHAP_THANH_CONG', dsOnline);
                        // Thông báo có người đăng nhập đến các user đang online,
                        //kèm theo ds user mới.
                        socket.broadcast.to(world).emit('SERVER_SEND_DS_USERS_ONLINE', dsOnline);
                        // Join vào room chứa các socket đã đăng nhập.
                        socket.join(world);
                    }
                }
                connection.end();
            }
        });
    });

    socket.on('USER_B_LEAVE_ROOM', () => {
        socket.room = undefined;
    });

    socket.on('USER_SEND_DANG_XUAT', () => {
        dangXuat(socket);
    });

    socket.on('disconnect', () => {
        console.log(`NGAT KET NOI: ${socket.id}`);
        //dangXuat(socket);
    });
});
//endregion
