const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();
require("./keep-alive");

const app = express();
const PORT = process.env.PORT || 3000;

// 🔹 Groq API Key 설정
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// ✅ KBO 선수별 팀 매칭 (AI가 이 데이터만 사용하도록 강제)
const KBO_PLAYERS_TEAMS = {
    "기아 타이거즈": [
        { name: "양현종", position: "투수" },
        { name: "나성범", position: "외야수" },
        { name: "이의리", position: "투수" },
        { name: "김도영", position: "내야수" }
    ],
    "삼성 라이온즈": [
        { name: "오승환", position: "투수" },
        { name: "구자욱", position: "외야수" },
        { name: "김영웅", position: "내야수" },
        { name: "원태인", position: "투수" }
    ],
    "LG 트윈스": [
        { name: "오지환", position: "내야수" },
        { name: "홍창기", position: "외야수" },
        { name: "임찬규", position: "투수" },
        { name: "박해민", position: "외야수" }
    ],
    "두산 베어스": [
        { name: "곽빈", position: "투수" },
        { name: "김택연", position: "투수" },
        { name: "양의지", position: "포수" },
        { name: "정수빈", position: "외야수" }
    ],
    "KT 위즈": [
        { name: "강백호", position: "내야수" },
        { name: "고영표", position: "투수" },
        { name: "박영현", position: "투수" },
        { name: "황재균", position: "내야수" }
    ],
    "SSG 랜더스": [
        { name: "최정", position: "내야수" },
        { name: "김광현", position: "투수" },
        { name: "박성한", position: "내야수" },
        { name: "박종훈", position: "투수" }
    ],
    "한화 이글스": [
        { name: "장시환", position: "투수" },
        { name: "노시환", position: "내야수" },
        { name: "류현진", position: "투수" },
        { name: "문동주", position: "투수" }
    ],
    "롯데 자이언츠": [
        { name: "이대호", position: "내야수" },
        { name: "전준우", position: "외야수" },
        { name: "박세웅", position: "투수" },
        { name: "윤동희", position: "외야수" }
    ],
    "NC 다이노스": [
        { name: "박민우", position: "내야수" },
        { name: "손아섭", position: "외야수" },
        { name: "박건우", position: "외야수" },
        { name: "김영규", position: "투수" }
    ],
    "키움 히어로즈": [
        { name: "이정후", position: "외야수" },
        { name: "송성문", position: "내야수" },
        { name: "안우진", position: "투수" },
        { name: "하영민", position: "투수" }
    ]
};

// Slack에서 보낸 데이터 처리
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 🔹 [1] Slack Slash Command(`/야구팀`) → 드롭다운 버튼이 포함된 메시지 전송
app.post("/slack-command", async (req, res) => {
    try {
        const userId = req.body.user_id;
        console.log(`✅ ${userId}님이 "/야구팀" 명령어 실행`);

        const responseMessage = {
            response_type: "in_channel",
            text: `안녕하다낭! <@${userId}>님, 좋아하는 KBO 팀이 있나낭? ⚾`,
            attachments: [
                {
                    text: "아래에서 선택해달라낭:",
                    fallback: "팀을 선택해달라낭.",
                    callback_id: "team_select",
                    color: "#FFD700",
                    attachment_type: "default",
                    actions: [
                        {
                            name: "team",
                            text: "야구팀 선택 ⚾",
                            type: "select",
                            options: [
                                { text: "기아 타이거즈", value: "기아 타이거즈" },
                                { text: "삼성 라이온즈", value: "삼성 라이온즈" },
                                { text: "LG 트윈스", value: "LG 트윈스" },
                                { text: "두산 베어스", value: "두산 베어스" },
                                { text: "KT 위즈", value: "KT 위즈" },
                                { text: "SSG 랜더스", value: "SSG 랜더스" },
                                { text: "한화 이글스", value: "한화 이글스" },
                                { text: "롯데 자이언츠", value: "롯데 자이언츠" },
                                { text: "NC 다이노스", value: "NC 다이노스" },
                                { text: "키움 히어로즈", value: "키움 히어로즈" }
                            ]
                        }
                    ]
                }
            ]
        };

        return res.json(responseMessage);
    } catch (error) {
        console.error("❌ Slack 명령어 처리 중 오류 발생:", error);
        res.status(500).send("서버 오류");
    }
});

// 🔹 [2] 사용자가 드롭다운에서 팀을 선택하면 Groq AI로 응답 생성
app.post("/slack-interactive", async (req, res) => {
    try {
        const payload = JSON.parse(req.body.payload);
        const userId = payload.user.id;
        console.log("✅ Slack 인터랙티브 요청 수신:", JSON.stringify(payload, null, 2));

        // ✅ [1] 포기 버튼 클릭 이벤트 처리
        if (payload.callback_id === "give_up" && payload.actions[0].name === "give_up") {
            if (!gameSessions[userId]) {
                return res.json({ text: "❌ 진행 중인 게임이 없습니다!" });
            }

            const correctAnswer = gameSessions[userId].secret;
            delete gameSessions[userId];

            // ✅ Slack 메시지 업데이트 (response_url 사용)
            await axios.post(payload.response_url, {
                response_type: "in_channel",
                replace_original: true,
                text: `💀 <@${userId}>님이 게임을 포기했습니다! 정답은 **${correctAnswer}** 이었습니다.`
            });

            return res.status(200).send();  // Slack 요청 정상 처리
        }

        // ✅ [2] 드롭다운 선택 이벤트 처리
        if (payload.actions && payload.actions[0].selected_options) {
            const teamName = payload.actions[0].selected_options[0].value;
            console.log(`✅ ${userId}님이 드롭다운에서 ${teamName}을 선택했습니다.`);

            // ✅ 선택된 팀의 선수 정보 가져오기
            const validPlayers = KBO_PLAYERS_TEAMS[teamName] || [];
            const chosenPlayer = validPlayers.length > 0 ? validPlayers[Math.floor(Math.random() * validPlayers.length)] : { name: "데이터 없음", position: "알 수 없음" };

            // 🔹 Groq AI API 요청
            const aiResponse = await axios.post(
                GROQ_API_URL,
                {
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: `당신은 KBO 야구 전문가이며, 사용자가 선택한 팀에 대한 정보와 당신의 생각, 호불호를 제공해야 합니다. 
                            반드시 제공된 데이터만을 사용하여 응답하십시오.
                            
                            사용자가 선택한 팀은 "${teamName}"이며, 대표 선수 중 한 명은 "${chosenPlayer.name}"입니다.
                            "${chosenPlayer.name}"의 포지션은 "${chosenPlayer.position}"입니다.
                            
                            응답은 반드시 3줄 이내로 작성하고, 모든 문장의 끝에 '나낭'을 덧붙일 것. 접미사 '나낭'을 반드시 붙인다.
                            "${teamName}"의 2023년 ~ 2024년 최근 경기력과 2025년 전망을 "${chosenPlayer.name}" 선수를 중심으로 설명할 것.
                            만약 "${chosenPlayer.name}"에 대한 정보가 부족하다면, ${chosenPlayer.name} 선수를 웹검색하거나, 
                            그래도 부족하면 "${chosenPlayer.name} 선수는 잘 모른다나낭."이라고 답할 것.
                            한국어와 영어만 사용하며, 중국어나 일본어 등 다른 언어를 절대로 출력하거나 사용하지 않을 것.`

                        },
                        {
                            role: "user",
                            content: `"${teamName}" 팀에 대한 너의 생각을 무조건 위의 형식에 맞춰서 말해.`
                        }
                    ],
                    max_tokens: 400,
                    temperature: 0.3
                },
                {
                    headers: {
                        Authorization: `Bearer ${GROQ_API_KEY}`,
                        "Content-Type": "application/json"
                    }
                }
            );

            // Groq AI 응답 텍스트 가져오기
            const aiText = aiResponse.data.choices[0].message.content.trim();

            // Slack 응답 메시지
            const responseMessage = {
                response_type: "in_channel",
                text: `<@${userId}>님이 좋아하는 팀은 *${teamName}*구나낭! 🎉\n\n${aiText}`
            };

            return res.json(responseMessage);
        }

        // ✅ 알 수 없는 요청일 경우 에러 반환
        console.error("❌ 잘못된 인터랙션 요청:", payload);
        return res.status(400).json({ text: "⚠️ 지원되지 않는 인터랙션 요청입니다." });

    } catch (error) {
        console.error("❌ Groq AI 응답 생성 중 오류 발생:", error);
        return res.status(500).send("서버 오류");
    }
});

// ✅ 유저별 게임 상태 저장
const gameSessions = {};

// ✅ 랜덤 3자리 숫자 생성 (중복 없는 숫자)
function generateRandomNumber() {
    const digits = Array.from({ length: 10 }, (_, i) => i);
    digits.sort(() => Math.random() - 0.5);
    return digits.slice(0, 3).join("");
}

// ✅ 숫자 비교 후 스트라이크 & 볼 계산
function checkGuess(secret, guess) {
    let strike = 0, ball = 0;
    for (let i = 0; i < 3; i++) {
        if (guess[i] === secret[i]) {
            strike++;
        } else if (secret.includes(guess[i])) {
            ball++;
        }
    }
    if (strike === 3) return "🎉 정답! 숫자를 맞혔습니다!";
    return `⚾ ${strike}S ${ball}B`;
}

// 🔹 Slack 데이터 처리
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ✅ [1] 숫자 야구 게임 시작 (/숫자야구)
app.post("/start-game", async (req, res) => {
    const userId = req.body.user_id;

    // 게임이 진행 중이면 새로운 게임 시작 X
    if (gameSessions[userId]) {
        return res.json({ text: "⚾ 이미 게임이 진행 중입니다! 숫자를 입력하세요." });
    }

    // 새로운 게임 시작
    const secretNumber = generateRandomNumber();
    gameSessions[userId] = { secret: secretNumber, attempts: 0 };

    console.log(`✅ [${userId}] 게임 시작 - 정답: ${secretNumber}`);

    return res.json({
        response_type: "in_channel",
        text: `<@${userId}>님이 숫자 야구 게임을 시작했습니다! ⚾  
        🎯 **0~9 사이의 서로 다른 3자리 숫자**를 맞혀보세요!  
        채팅으로 숫자(예: \`123\`, \`567\`)를 입력하면 자동으로 확인됩니다!
        S : 숫자와 자리가 일치해요!
        B : 숫자만 일치해요!`,
        attachments: [
            {
                text: "게임을 포기하시겠어요?",
                fallback: "포기 버튼을 사용할 수 없습니다.",
                callback_id: "give_up",
                color: "#FF0000",
                actions: [
                    {
                        name: "give_up",
                        text: "포기하기 💀",
                        type: "button",
                        value: userId
                    }
                ]
            }
        ]
    });
});

// ✅ [2] Slack Event Subscription 설정 (이벤트 핸들러)
app.post("/event-subscription", async (req, res) => {
    // Slack에서 challenge 확인 요청이 들어오면 그대로 반환
    if (req.body.challenge) {
        return res.json({ challenge: req.body.challenge });
    }

    const event = req.body.event;

    console.log("📢 [DEBUG] Slack 이벤트 수신:", JSON.stringify(event, null, 2));

    // ✅ 메시지 감지 (Bot 메시지는 무시)
    if (event && event.type === "message" && !event.subtype) {
        const userId = event.user;
        const channelId = event.channel;
        const messageText = event.text.trim();

        console.log(`✅ [${userId}] 메시지 감지: ${messageText}`);

        // ✅ 숫자인 경우만 처리 (3자리 숫자)
        if (/^\d{3}$/.test(messageText)) {
            // 게임이 진행 중인지 확인
            if (!gameSessions[userId]) {
                console.log(`⚠️ [${userId}] 게임이 진행 중이 아님 (응답 X)`);
                return res.status(200).send(); // **응답하지 않고 종료**
            }

            const { secret, attempts } = gameSessions[userId];
            gameSessions[userId].attempts++;

            const result = checkGuess(secret, messageText);

            let responseText;
            if (result.includes("정답")) {
                const attemptsCount = gameSessions[userId].attempts;
                delete gameSessions[userId];
                responseText = `🎉 <@${userId}>님이 **${attemptsCount}번 만에 정답**을 맞혔습니다! 🎯`;
            } else {
                responseText = `🎯 <@${userId}>님의 입력: \`${messageText}\`\n${result}`;
            }

            // ✅ Slack API를 사용하여 숫자 야구 결과 전송
            await axios.post("https://slack.com/api/chat.postMessage", {
                channel: channelId,
                text: responseText
            }, {
                headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` }
            });

            return res.status(200).send();
        }
    }

    res.status(200).send("OK");  // Slack API 요청 정상 응답
});


// ✅ [3] 게임 포기 버튼 처리 (Interactivity API)
app.post("/interactive", async (req, res) => {
    const payload = JSON.parse(req.body.payload);
    const userId = payload.user.id;
    
    console.log("✅ 인터랙티브 요청 수신:", payload);

    // ✅ Slack에서 버튼 클릭 시, callback_id 기반으로 이벤트 처리
    if (payload.callback_id === "give_up") {
        // 게임이 진행 중인지 확인
        if (!gameSessions[userId]) {
            return res.json({ text: "❌ 진행 중인 게임이 없습니다!" });
        }

        const correctAnswer = gameSessions[userId].secret;
        delete gameSessions[userId];

        // ✅ Slack 메시지 업데이트 (response_url 사용)
        await axios.post(payload.response_url, {
            response_type: "in_channel",
            replace_original: true, // 기존 메시지를 업데이트
            text: `💀 <@${userId}>님이 게임을 포기했습니다! 정답은 **${correctAnswer}** 이었습니다.`
        });

        return res.status(200).send();  // Slack 요청 정상 처리
    }

    return res.status(400).send("잘못된 요청입니다.");
});


// 서버 실행
app.listen(PORT, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
});
