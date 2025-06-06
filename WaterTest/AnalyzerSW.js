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
    { ph: 1,  color: [175, 12, 8] },
    { ph: 2,  color: [223, 32, 10] },
    { ph: 3,  color: [245, 61, 14] },
    { ph: 4,  color: [255, 97, 97] },
    { ph: 5,  color: [255, 128, 28] },
    { ph: 6,  color: [255, 176, 63] },
    { ph: 7,  color: [213, 218, 119] },
    { ph: 8,  color: [123, 208, 58] },
    { ph: 9,  color: [42, 111, 242] },
    { ph: 10, color: [14, 33, 162] },
    { ph: 11, color: [21, 28, 97] },
    { ph: 12, color: [26, 27, 62] }
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

// 計算紅框 RGB 值平均
function getAverageColor(box) {
    // 1. 先繪出 video 畫面至 canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 2. 抓 video 實際在畫面上的 bounding box
    const videoRect = video.getBoundingClientRect();
    // 3. 抓紅框在畫面上的 bounding box
    const boxRect = box.getBoundingClientRect();

    // 4. 紅框左上角在 video 內的相對座標（單位：畫面上的像素）
    const leftOnDisplay = boxRect.left - videoRect.left;
    const topOnDisplay = boxRect.top - videoRect.top;
    // 寬高
    const boxWidth = boxRect.width;
    const boxHeight = boxRect.height;

    // 5. 計算比例，換算到 video 原始畫素座標
    const scaleX = video.videoWidth / videoRect.width;
    const scaleY = video.videoHeight / videoRect.height;
    const imgX = leftOnDisplay * scaleX;
    const imgY = topOnDisplay * scaleY;
    const imgW = boxWidth * scaleX;
    const imgH = boxHeight * scaleY;

    // 6. 四捨五入、取整
    const intX = Math.round(imgX);
    const intY = Math.round(imgY);
    const intW = Math.round(imgW);
    const intH = Math.round(imgH);

    // 防呆
    if (intW <= 0 || intH <= 0) return { r: 0, g: 0, b: 0 };
    if (intX < 0 || intY < 0 || intX+intW > canvas.width || intY+intH > canvas.height) {
        // 若紅框有出界，直接回傳0
        return { r: 0, g: 0, b: 0 };
    }

    // 7. 取得畫面區域像素資料
    const imageData = ctx.getImageData(intX, intY, intW, intH).data;

    // 8. 只計算圓內像素
    let r = 0, g = 0, b = 0, count = 0;
    const cx = intW / 2;
    const cy = intH / 2;
    const radius = Math.min(intW, intH) / 2;
    for (let y = 0; y < intH; y++) {
        for (let x = 0; x < intW; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if (dx*dx + dy*dy > radius*radius) continue; // 只算圓內
            const idx = (y * intW + x) * 4;
            r += imageData[idx];
            g += imageData[idx + 1];
            b += imageData[idx + 2];
            count++;
        }
    }
    if (count === 0) return { r: 0, g: 0, b: 0 };
    return { r: r / count, g: g / count, b: b / count };
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
    let minIndex = 0;
    let minDist = Number.MAX_VALUE;
    // 找距離最近的標準點
    for (let i = 0; i < phColorTable.length; i++) {
        const ref = phColorTable[i];
        const dr = r - ref.color[0];
        const dg = g - ref.color[1];
        const db = b - ref.color[2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < minDist) {
            minDist = dist;
            minIndex = i;
        }
    }

    // 插值：找最近兩個點（左/右），並在線上找比例
    let idx1 = minIndex;
    let idx2 = (minIndex === phColorTable.length - 1)
        ? minIndex - 1
        : minIndex + 1;
    if (minIndex === 0) idx2 = 1;

    const p1 = phColorTable[idx1];
    const p2 = phColorTable[idx2];

    // 向量點積，算色點在線段上的投影比例
    const v1 = p2.color.map((c, j) => c - p1.color[j]);
    const v2 = [r - p1.color[0], g - p1.color[1], b - p1.color[2]];
    const dot = v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
    const len2 = v1[0]*v1[0] + v1[1]*v1[1] + v1[2]*v1[2];
    let t = len2 === 0 ? 0 : dot / len2;

    // 限制t在0~1之間
    t = Math.max(0, Math.min(1, t));

    // 插值得到ph
    let ph = p1.ph + (p2.ph - p1.ph) * t;
    // 四捨五入到小數點後1位
    return Math.round(ph * 10) / 10;
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

    // 只保留這裡，動態決定哪些圈要分析
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
        const color = getAverageColor(box);
        let label = (i === 0) ? "主圈" : `紅圈${i + 1}`;
        resultHtml += `<div>
            <b>${label}</b> (ID:${circleIds[i]})<br>
            R: ${color.r.toFixed(1)}　
            G: ${color.g.toFixed(1)}　
            B: ${color.b.toFixed(1)}
        </div>`;
        if (i === 0) mainColor = color;
    }

    // 酸鹼值模式：插值顯示 pH
    if(labelText === "酸鹼值" && mainColor) {
        const ph = getInterpolatedPhValue(mainColor.r, mainColor.g, mainColor.b);
        resultHtml += `<div style="margin-top:8px;">
            <b>主圈推論 pH：</b>
            <span style="font-size:20px;color:#1976D2;">${ph.toFixed(1)}</span>
        </div>`;
    }

    result.innerHTML = resultHtml;

    // 其餘分支預留（可加算式）
    if(labelText === "溶氧量") {
        // 溶氧量 算式
    } else if(labelText === "濁度") {
        // 濁度 算式
    } else if(labelText !== "酸鹼值") {
        alert("請選擇檢測項目！");
    }
});