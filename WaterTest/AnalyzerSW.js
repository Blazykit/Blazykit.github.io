// 攝影機與紅框設定
const video = document.getElementById('camera');
const btnPH = document.getElementById('btnPH');
const btnOxygen = document.getElementById('btnOxygen');
const btnTurbidity = document.getElementById('btnTurbidity');
const analyzeBtn = document.getElementById('analyzeBtn');
const result = document.getElementById('result');
const redBox1 = document.getElementById('redBox1');
const boxLabel = document.getElementById('boxLabel');

const phColorTable = [

    { ph: 4,  color: [160.0, 66.0, 70.0] },
    { ph: 5,  color: [190.0, 85.0, 76.0] },
    { ph: 6,  color: [197.0, 200.0, 124.0] },
    { ph: 7,  color: [140.0, 162.1, 86.4] },
    { ph: 8,  color: [87.0, 125.0, 85.0] },
    { ph: 9,  color: [65.0, 63.5, 75.0] },
    { ph: 10, color: [115.0, 25.8, 46.5] },
];

const oxygenStd = [
    { boxId: "redBox2", concentration: 0 },   
    { boxId: "redBox3", concentration: 4 },   
    { boxId: "redBox4", concentration: 8 }   
];

let stream;
let interval;
let logRGBValues = [];

let redBoxPositions = {
    redBox1: { left: 0, top: 0 },
};

// 啟動攝影機功能
async function startCamera() {
    video.setAttribute('playsinline', true);
    video.setAttribute('webkit-playsinline', true);

    try {
        const constraints = {
            video: { facingMode: 'environment' }
        };

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("瀏覽器不支援 getUserMedia");
        }

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.onloadedmetadata = () => video.play();
        isCameraNotReady = false;
        analyzeBtn.disabled = false;

    } catch (err) {
        console.error("攝影機錯誤: ", err);
        result.innerHTML = `錯誤：無法啟動攝影機。${err.message}`;
        alert("請開啟攝像頭！")
        analyzeBtn.disabled = true;
    }
}

// 開啟相機
startCamera()

// 紅框拖曳功能
function makeDraggable(box) {
    let offsetX = 0, offsetY = 0, isDragging = false;

    function startDragging(e) {
        isDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const parentRect = box.offsetParent.getBoundingClientRect();
        const boxRect = box.getBoundingClientRect();

        offsetX = clientX - boxRect.left;
        offsetY = clientY - boxRect.top;

        e.preventDefault();
        e.stopPropagation();
        document.body.style.cursor = 'grabbing';
    }

    function moveDragging(e) {
        if (!isDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const parent = box.offsetParent;
        const camera = document.getElementById('camera');
        const parentRect = parent.getBoundingClientRect();
        const cameraRect = camera.getBoundingClientRect();

        const cameraOffsetLeft = cameraRect.left - parentRect.left;
        const cameraOffsetTop = cameraRect.top - parentRect.top;

        const boxWidth = box.offsetWidth;
        const boxHeight = box.offsetHeight;

        const rawLeft = clientX - parentRect.left - offsetX;
        const rawTop = clientY - parentRect.top - offsetY;

        const minLeft = cameraOffsetLeft;
        const maxLeft = cameraOffsetLeft + camera.offsetWidth - boxWidth;
        const minTop = cameraOffsetTop;
        const maxTop = cameraOffsetTop + camera.offsetHeight - boxHeight;

        const newLeft = Math.max(minLeft, Math.min(rawLeft, maxLeft));
        const newTop = Math.max(minTop, Math.min(rawTop, maxTop));

        box.style.left = `${newLeft}px`;
        box.style.top = `${newTop}px`;

        redBoxPositions[box.id] = { left: newLeft, top: newTop };
    }

    function stopDragging() {
        isDragging = false;
        document.body.style.cursor = 'default';
    }

    box.addEventListener('mousedown', startDragging);
    box.addEventListener('touchstart', startDragging);
    document.addEventListener('mousemove', moveDragging);
    document.addEventListener('touchmove', moveDragging, { passive: false });
    document.addEventListener('mouseup', stopDragging);
    document.addEventListener('touchend', stopDragging);
}

// 計算紅框 RGB 值中位數
function getMedianColor(box) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const videoRect = video.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    const leftOnDisplay = boxRect.left - videoRect.left;
    const topOnDisplay = boxRect.top - videoRect.top;
    const boxWidth = boxRect.width;
    const boxHeight = boxRect.height;

    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;
    const imgX = leftOnDisplay * scaleX;
    const imgY = topOnDisplay * scaleY;
    const imgW = boxWidth * scaleX;
    const imgH = boxHeight * scaleY;

    const intX = Math.round(imgX);
    const intY = Math.round(imgY);
    const intW = Math.round(imgW);
    const intH = Math.round(imgH);

    if (intW <= 0 || intH <= 0) return { r: 0, g: 0, b: 0 };
    if (intX < 0 || intY < 0 || intX+intW > canvas.width || intY+intH > canvas.height) {
        return { r: 0, g: 0, b: 0 };
    }

    const imageData = ctx.getImageData(intX, intY, intW, intH).data;

    const rArr = [], gArr = [], bArr = [];
    const cx = intW / 2;
    const cy = intH / 2;
    const radius = Math.min(intW, intH) / 2;
    for (let y = 0; y < intH; y++) {
        for (let x = 0; x < intW; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx*dx + dy*dy > radius*radius) continue;
            const idx = (y * intW + x) * 4;
            rArr.push(imageData[idx]);
            gArr.push(imageData[idx + 1]);
            bArr.push(imageData[idx + 2]);
        }
    }
    // Helper: 中位數
    function median(arr) {
        if (arr.length === 0) return 0;
        arr.sort((a, b) => a - b);
        const mid = Math.floor(arr.length / 2);
        return arr.length % 2 === 0 ? (arr[mid-1] + arr[mid]) / 2 : arr[mid];
    }
    return {
        r: median(rArr),
        g: median(gArr),
        b: median(bArr)
    };
}


//拖曳紅框
makeDraggable(redBox1);

const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
if (isMobile) {
    document.body.style.overflow = 'hidden';
}

//按鈕功能
//pH
btnPH.addEventListener("click", function () {
        // 1. 改紅框邊框顏色
        redBox1.style.borderColor = '#1976D2';

        // 2. 改標籤文字
         boxLabel.textContent = "酸鹼值";

        //算式

});

//溶氧
btnOxygen.addEventListener("click", function () {
        // 1. 改紅框邊框顏色
        redBox1.style.borderColor = '#4CAF50';

        // 2. 改標籤文字
         boxLabel.textContent = "溶氧量";

        //算式
});

//濁度
btnTurbidity.addEventListener("click", function () {
        // 1. 改紅框邊框顏色
        redBox1.style.borderColor = '#EF6C00';

        // 2. 改標籤文字
         boxLabel.textContent = "濁度";

        //算式
});

function createFixedCircle(id, left, top) {
    if (document.getElementById(id)) return;
    const box = document.createElement('div');
    box.className = 'redBox fixed';
    box.id = id;
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.borderColor = '#FF1744'; // 紅色
    document.querySelector('.container').appendChild(box);
}
function removeFixedCircles() {
    for (let i = 2; i <= 4; i++) {
        const box = document.getElementById(`redBox${i}`);
        if (box) box.remove();
    }
}
btnPH.addEventListener("click", function () {
    redBox1.style.borderColor = '#1976D2';
    boxLabel.textContent = "酸鹼值";
    removeFixedCircles();
});
btnOxygen.addEventListener("click", function () {
    redBox1.style.borderColor = '#4CAF50';
    boxLabel.textContent = "溶氧量";
    removeFixedCircles();
    createFixedCircle('redBox2', 100, 50);
    createFixedCircle('redBox3', 100, 175);
    createFixedCircle('redBox4', 100, 300);
});
btnTurbidity.addEventListener("click", function () {
    redBox1.style.borderColor = '#EF6C00';
    boxLabel.textContent = "濁度";
    removeFixedCircles();
});


function getInterpolatedPhValue(r, g, b) {
    let minDist = Number.MAX_VALUE;
    let minIdx = 0;

    for (let i = 0; i < phColorTable.length; i++) {
        const ref = phColorTable[i];
        const dr = r - ref.color[0];
        const dg = g - ref.color[1];
        const db = b - ref.color[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
            minDist = dist;
            minIdx = i;
        }
    }

    // 插值兩點
    let idx1 = minIdx;
    let idx2;
    if (minIdx === 0) {
        idx2 = 1;
    } else if (minIdx === phColorTable.length - 1) {
        idx2 = minIdx - 1;
    } else {
        // 比較前後哪個鄰點距離近
        const distPrev = Math.pow(r - phColorTable[minIdx - 1].color[0], 2) +
                         Math.pow(g - phColorTable[minIdx - 1].color[1], 2) +
                         Math.pow(b - phColorTable[minIdx - 1].color[2], 2);
        const distNext = Math.pow(r - phColorTable[minIdx + 1].color[0], 2) +
                         Math.pow(g - phColorTable[minIdx + 1].color[1], 2) +
                         Math.pow(b - phColorTable[minIdx + 1].color[2], 2);
        idx2 = (distPrev < distNext) ? minIdx - 1 : minIdx + 1;
    }

    const p1 = phColorTable[idx1];
    const p2 = phColorTable[idx2];

    // 線性插值百分比
    const v1 = p2.color.map((c, j) => c - p1.color[j]);
    const v2 = [r - p1.color[0], g - p1.color[1], b - p1.color[2]];
    const dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    const len2 = v1[0]*v1[0] + v1[1]*v1[1] + v1[2]*v1[2];
    let t = len2 === 0 ? 0 : dot / len2;
    t = Math.max(0, Math.min(1, t));

    let ph = p1.ph + (p2.ph - p1.ph) * t;
    // 邊界修正
    ph = Math.max(phColorTable[0].ph, Math.min(phColorTable[phColorTable.length - 1].ph, ph));
    return Math.round(ph * 10) / 10;
}


function quadraticFit(x, y) {
    // x 與 y 均為三元素陣列
    // 建立三元一次聯立方程式
    const X = [
        [x[0]*x[0], x[0], 1],
        [x[1]*x[1], x[1], 1],
        [x[2]*x[2], x[2], 1]
    ];
    const Y = [y[0], y[1], y[2]];

    // 高斯消去法解 3x3 方程組
    function gaussian(A, b) {
        const n = b.length;
        for (let i = 0; i < n; i++) {
            // 主元化
            let maxRow = i;
            for (let k = i + 1; k < n; k++) {
                if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
            }
            [A[i], A[maxRow]] = [A[maxRow], A[i]];
            [b[i], b[maxRow]] = [b[maxRow], b[i]];
            // 歸一化
            let div = A[i][i];
            for (let j = i; j < n; j++) A[i][j] /= div;
            b[i] /= div;
            // 消元
            for (let k = i + 1; k < n; k++) {
                let c = A[k][i];
                for (let j = i; j < n; j++) A[k][j] -= c * A[i][j];
                b[k] -= c * b[i];
            }
        }
        // 回代
        let x = new Array(n);
        for (let i = n - 1; i >= 0; i--) {
            x[i] = b[i];
            for (let j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j];
        }
        return x;
    }
    const coeffs = gaussian(X, Y);
    return { a: coeffs[0], b: coeffs[1], c: coeffs[2] };
}


btnTurbidity.addEventListener("click", function () {
    redBox1.style.borderColor = '#EF6C00';
    boxLabel.textContent = "濁度";
    removeFixedCircles();
    createFixedCircle('redBox2', 100, 50);
    createFixedCircle('redBox3', 100, 175);
    createFixedCircle('redBox4', 100, 300);
});

analyzeBtn.addEventListener("click", function () {
    const labelText = boxLabel.textContent.trim();

    let circleIds = ["redBox1"];
    if (labelText === "溶氧量" || labelText === "濁度") {
        for (let i = 2; i <= 4; i++) {
            if (document.getElementById(`redBox${i}`)) {
                circleIds.push(`redBox${i}`);
            }
        }
    }

    let resultHtml = "";
    let mainColor = null;
    for (let i = 0; i < circleIds.length; i++) {
        const box = document.getElementById(circleIds[i]);
        if (!box) continue;
        const color = getMedianColor(box);
        let label = (i === 0) ? "主圈" : `紅圈${i + 1}`;
        resultHtml += `<div>
            <b>${label}</b> (ID:${circleIds[i]})<br>
            R: ${color.r.toFixed(1)}　
            G: ${color.g.toFixed(1)}　
            B: ${color.b.toFixed(1)}
        </div>`;
        if (i === 0) mainColor = color;
    }

    // 判斷類型並處理進階分析
    if (labelText === "酸鹼值" && mainColor) {
    const ph = getInterpolatedPhValue(mainColor.r, mainColor.g, mainColor.b);
    resultHtml += `<div style="margin-top:8px;">
        <b>主圈推論 pH：</b>
        <span style="font-size:20px;color:#1976D2;">${ph.toFixed(1)}</span>
    </div>`;
}
else if (labelText === "溶氧量" && mainColor) {
    let x = [], y = [];
    let valid = true;
    for (const std of oxygenStd) {
        const box = document.getElementById(std.boxId);
        if (!box) { valid = false; break; }
        const color = getMedianColor(box);
        x.push(color.r);
        y.push(std.concentration);
    }
    if (!valid) {
        resultHtml += `<div style="color:red">標定紅圈尚未完整顯示，請確認。</div>`;
    } else {
        const fit = quadraticFit(x, y);
        const conc = fit.a * mainColor.r * mainColor.r + fit.b * mainColor.r + fit.c;
        resultHtml += `<div style="margin-top:8px;">
            <b>主圈對應溶氧量：</b>
            <span style="font-size:20px;color:#4CAF50;">${conc.toFixed(2)} ppm</span><br>
            <span style="font-size:12px;color:gray;">
                標定點R值：${x.map(v=>v.toFixed(1)).join(', ')}<br>
                主圈R值：${mainColor.r.toFixed(1)}<br>
                二次回歸方程：O₂ = ${fit.a.toExponential(4)} × R² + ${fit.b.toExponential(4)} × R + ${fit.c.toExponential(4)}
            </span>
        </div>`;
    }
}

else if (labelText === "濁度") {
    // TODO: 濁度演算尚未實作
}
else if (labelText !== "酸鹼值" && labelText !== "溶氧量" && labelText !== "濁度") {
    alert("請選擇檢測項目！");
}
result.innerHTML = resultHtml;
});