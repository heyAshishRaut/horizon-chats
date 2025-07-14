import { useEffect, useRef, useState } from "react";
import icon from "./assets/icon.png"
import user from "./assets/user.png"
import { AnimatePresence, motion } from "framer-motion";

function App() {
    const bottomRef = useRef<HTMLDivElement | null>(null);
    // 03 testing

    // News
    const [items, setItems] = useState([]);
    const [index, setIndex] = useState(0);
    // @ts-ignore
    const [error, setError] = useState("");

    const wsRef = useRef<WebSocket | null>(null);

    // User info
    const [verify, setVerify] = useState(true);

    // Fullname and email verification
    const [fullname, setFullname] = useState("");
    const [email, setEmail] = useState("");

    // Read fullname and email from SessionStorage
    const [readFullname, setReadFullname] = useState("");
    const [readEmail, setReadEmail] = useState("");

    // Fullname and email checking for empty field
    const [alertBox, setAlertBox] = useState(false);
    const [alertMsg, setAlertMsg] = useState("");

    // Total participants in the room
    const [participants, setParticipants] = useState(0)

    // User message [SEND]
    const [message, setMessage] = useState("")

    // Leave Space
    const [leave, setLeave] = useState(false)
    const [leaveBtn, setLeaveBtn] = useState(false)

    // All messages
    type ChatMessage = {
        userId: any;
        fullname: string;
        message: string;
        time: string;
    };

    const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);


    function goToChat() {
        if (!fullname || !email) {
            setAlertMsg("All fields are required!");
            setAlertBox(true);
            setTimeout(() => {
                setAlertBox(false);
                setAlertMsg("");
            }, 3000);
            return;
        }

        const id = generateUUID();

        const arrOfFullName = fullname.trim().split(" ");

        let firstname = arrOfFullName[0];
        firstname = firstname[0].toUpperCase() + firstname.slice(1);

        let lastname = arrOfFullName[1] || "";
        lastname = lastname ? lastname[0].toUpperCase() + lastname.slice(1) : "";

        const finalFullName = firstname + (lastname ? " " + lastname : "");

        const userObj = {
            fullname: finalFullName,
            email,
            userId: id,
        };

        sessionStorage.setItem("userDetails", JSON.stringify(userObj));
        setReadFullname(finalFullName);
        setReadEmail(email);

        setVerify(false);
    }

    // Unique ID Generation
    function generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    // Ex- 8b11b3c0-7f99-41b8-90e4-7d6be18a4a7f

    const API_KEY = process.env.REACT_APP_NEWS_API_KEY
    const [userID, setUserID] = useState("")

    useEffect(() => {
        if (allMessages.length > 0) {
            sessionStorage.setItem("chatMessages", JSON.stringify(allMessages));
        }
    }, [allMessages]);

    useEffect(() => {
        const userDetailsRaw = sessionStorage.getItem("userDetails");

        if (userDetailsRaw) {
            const userDetails = JSON.parse(userDetailsRaw) as {
                fullname: string;
                email: string;
                userId: string;
            };

            setReadFullname(userDetails.fullname);
            setReadEmail(userDetails.email);
            setVerify(false);
        }
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [allMessages]);

    useEffect(() => {
        if (verify) return;

        if (leaveBtn) {
            const handleLeave = () => {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.close();
                    console.log("WebSocket closed by user");
                }

                sessionStorage.removeItem("userDetails");
                sessionStorage.removeItem("chatMessages");

                setVerify(true);
            };

            handleLeave();
            return; 
        }

        const userDetailsRaw = sessionStorage.getItem("userDetails");

        const messagesRaw = sessionStorage.getItem("chatMessages");
        if (messagesRaw) {
            try {
                const messages: ChatMessage[] = JSON.parse(messagesRaw);
                setAllMessages(messages);
            } catch (err) {
                console.error("Failed to parse stored chat messages", err);
            }
        }

        let userId: string | null = null;

        // @ts-ignore
        const userDetails = JSON.parse(userDetailsRaw);
        userId = userDetails.userId

        // @ts-ignore
        setUserID(userId)

        // added Render URL
        const ws = new WebSocket(process.env.REACT_APP_WS_URL as string);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log("Connected to server");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === "userCount") {
                setParticipants(data.count);
            }
            else if (data.type === "error") {
                setAlertBox(true);
                setAlertMsg(data.message);
                setTimeout(() => {
                    setAlertBox(false);
                    setAlertMsg("");
                }, 3000);
            }
            else if (data.type === "message") {
                const userMsg = {
                    userId: data.userId,
                    fullname: data.fullname,
                    message: data.message,
                    time: data.time
                }

                setAllMessages((prev) => [...prev, userMsg]);
            }
        };

        ws.onclose = () => {
            console.log("Disconnected");
        };

        ws.onerror = (err) => {
            console.error("WebSocket error:", err);

            sessionStorage.removeItem("chatMessages");
            sessionStorage.removeItem("userDetails");
        };

        const closeTimer = setTimeout(() => {
            console.log("Closing WebSocket after 2 hours...");

            sessionStorage.removeItem("chatMessages");
            sessionStorage.removeItem("userDetails");

            ws.close();
        }, 2 * 60 * 60 * 1000); 

        return () => {
            ws.close();
            clearTimeout(closeTimer);
        };
    }, [verify, leaveBtn]);

    useEffect(() => {
        getNews()

        if (items.length === 0) return;

        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % items.length);
        }, 10000);

        return () => clearInterval(interval);
    }, [items.length]);

    async function getNews() {
        try {
            const res = await fetch(
                `https://gnews.io/api/v4/search?q=example&apikey=${API_KEY}`
            );
            const data = await res.json();

            if (!data.articles || !Array.isArray(data.articles)) {
                setError("No articles found");
                return;
            }

            const formattedItems = data.articles.map((article: any) => ({
                image: article.image,               
                title: article.title,
                description: article.description,
                source: article.source.name,          
                url: article.url
            }));

            setItems(formattedItems);
        } catch (err) {
            setError("Can't fetch news");
            console.error(err);
        }
    }

    function sendMessageBody() {
        let fullname = ""
        if (message.length == 0) {
            return;
        }

        const userDetailsRaw = sessionStorage.getItem("userDetails");

        let userId: string | null = null;

        if (userDetailsRaw) {
            const userDetails = JSON.parse(userDetailsRaw);
            fullname = userDetails.fullname
            userId = userDetails.userId
        }
        console.log("Send body - ", userId);

        const messageBody = {
            type: "message",
            fullname: fullname,
            message: message,
            userId: userId,
            time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            })
        }

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(messageBody))
            setMessage("");
        }
    }

    return (
        // Container with background div
        <div className="h-screen w-screen bg-black
        px-[8px]
        md:px-[50px]
        lg:px-[120px]
        ">
            <div
                className="absolute inset-0 z-0"
                style={{
                    backgroundImage: `
                    radial-gradient(circle at 50% 100%, rgba(70, 85, 110, 0.5) 0%, transparent 60%),
                    radial-gradient(circle at 50% 100%, rgba(99, 102, 241, 0.4) 0%, transparent 70%),
                    radial-gradient(circle at 50% 100%, rgba(181, 184, 208, 0.3) 0%, transparent 80%)`,
                }}
            />

            <AnimatePresence>
                {verify && (
                    <motion.div
                        className="fixed inset-0 z-50 flex items-center justify-center w-[100%] h-[100%] bg-black
                        p-[10px]
                        md:p-0"
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}

                    >
                        < div
                            className="absolute inset-0 z-0"
                            style={{
                                background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99, 102, 241, 0.25), transparent 70%), #000000",
                            }}
                        />
                        <motion.div className="w-full md:w-[700px] h-[80%] md:h-[550px] 
                        backdrop-blur-xl bg-white/10 rounded-3xl"
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="p-4">
                                <div className="h-[30px] md:h-[40px] flex flex-col">
                                    <div className="h-full flex gap-x-1 items-center justify-start">
                                        <img src={icon} alt="" className="h-full" />
                                        <div className="text-2xl md:text-3xl font-gambarino font-semibold text-white">Wave</div>
                                    </div>

                                    <div className="flex flex-col pt-8">
                                        <div className="text-center text-white text-2xl font-gambarino font-semibold leading-8">
                                            <div>Wherever you're from, you're welcome here.</div>
                                            <div>Say hi to someone new.</div>
                                          
                                        </div>

                                        <div className="flex flex-col items-center gap-y-4 font-excon pt-6 md:pt-12">
                                            <input onChange={(e) => setFullname(e.target.value)} type="text" placeholder="Full name" className={`py-3 px-4 rounded-xl outline-none w-[80%] md:w-[60%]`} />
                                            <input onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="py-3 px-4 rounded-xl outline-none border-none w-[80%] md:w-[60%]" />
                                            <button onClick={() => goToChat()} className="text-white px-10 py-3 rounded-xl bg-blue-800/80 hover:bg-blue-800/60">Join</button>
                                            <div className="mt-8 text-white bg-blue-600/20 py-4 px-5 rounded-2xl text-sm text-gray-100/60">
                                                Keep the chat positive and respectful. No hate speech, threats, or offensive content. <br />
                                                Maximum 25 participants can join at a time. <br />
                                                After 2 hours, the chat space will automatically close.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Alert Box */}
            {alertBox &&
                <motion.div
                    initial={{ opacity: 0, y: 0 }}
                    animate={{ opacity: 1, y: 5 }}
                    transition={{ duration: 0.5, ease: "easeIn" }}
                    className='absolute z-[100] top-3 px-8 py-3 left-[27%] md:left-[40%] lg:left-[43%] flex items-center text-gray-100/80 bg-red-500/30 rounded-xl'>
                    {alertMsg}
                </motion.div>
            }

            {/* Navbar */}
            <div className="h-[8%] py-2 flex items-center justify-between text-white font-gambarino font-semibold
            text-xl
            lg:text-3xl">
                <div className="h-full flex items-center md:gap-x-1">
                    <img src={icon} alt="" className="h-full p-2 md:p-0" />
                    <div className="">Horizon</div>
                    <div className="px-3 h-[23px] bg-blue-500/30 ml-2 font-excon font-extralight flex items-center text-[12px] rounded-xl ">Preview</div>
                </div>
                <div className="h-full pr-4 md:pr-10 flex items-center justify-center">
                    <div>Community Space</div>

                </div>
            </div>

            {/* Body [MAIN] */}
            {/* Check padding for mobile screen in Main body parent tag */}
            <div className="h-[92%] w-full flex justify-center font-excon
            py-2 
            md:pt-2 md:pb-4">
                {/* Parent containing news and chat section */}
                <div className="h-full flex gap-x-2
                w-full
                lg:w-[80%]
                ">
                    <AnimatePresence>
                        {leave && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="absolute top-3 left-[580px] z-100 font-excon flex items-center gap-x-4 bg-neutral-500/30 p-1 text-white rounded-xl"
                            >
                                <div className="pl-4 text-sm">
                                    You’re about to leave this space. Proceed?
                                </div>

                                <div
                                    className="py-2 px-8 cursor-pointer text-sm bg-red-500/80 hover:bg-red-500 rounded-lg text-white/90"
                                    onClick={() => setLeaveBtn(true)}
                                >
                                    Leave
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    
                    {/* News section */}
                    <div className="lg:w-[35%] md:w-[40%] h-full bg-stone-500/20 rounded-2xl backdrop-blur-3xl hidden md:block overflow-hidden">
                        {/* News Section > Participants */}
                        <div className="h-[8%] font-gambarino text-white px-4 pt-4 flex items-center justify-between
                        md:text-lg
                        lg:text-xl
                        ">
                            
                            <div>Participants</div>
                            <div className="flex gap-x-4 items-center">
                                <div>{participants}/25</div>
                                <div onClick={() => setLeave(!leave)} className="cursor-pointer">
                                    {
                                        !leave ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-8">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                                            </svg>
                                        ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" className="size-8">
                                                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                                                </svg>
                                        )
                                    }
                                </div>
                            </div>   
                        </div>
                        
                        {/* News Section > News */}
                        <div className="h-[75%] w-full overflow-hidden">
                            <div
                                className="flex h-full transition-transform duration-1000 ease-in-out"
                                style={{ transform: `translateX(-${index * 100}%)` }}
                            >
                                {items.map((item, i) => (
                                    <div
                                        key={i}
                                        className={`w-full h-full shrink-0 p-4 flex items-center justify-center text-xl overflow-hidden`}
                                    >
                                        <div className="h-full w-full bg-black/30 rounded-xl p-3 flex flex-col gap-y-2 text-white relative">
                                            {/* Image */}
                                            <div className="h-[40%] overflow-hidden">
                                                {/* @ts-ignore */}
                                                <img className="rounded-lg h-full w-full object-cover" src={item.image} alt="" />
                                            </div>

                                            {/* Heading */}
                                            <div className="">
                                                {/* @ts-ignore */}
                                                <div className="font-gambarino text-lg">{item.title}</div>
                                            </div>

                                            {/* Description */}
                                            <div className="">
                                                <div className="h-full font-excon text-gray-200/70 text-justify leading-[16px] text-[13px]">
                                                    {/* @ts-ignore */}
                                                    {item.description}
                                                </div>
                                            </div>

                                            {/* Open link */}
                                            <a
                                                target="_blank"
                                                // @ts-ignore 
                                                href={item.url}
                                                rel="noreferrer"
                                                className="bg-blue-600/30 hover:bg-blue-800/30 self-end p-3 rounded-xl absolute bottom-3"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    strokeWidth="2.5"
                                                    stroke="currentColor"
                                                    className="size-4"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" />
                                                </svg>
                                            </a>

                                            {/* Author name */}
                                            {/* @ts-ignore */}
                                            <div className="self-start absolute bottom-3 text-[17px] font-gambarino">{item.source["name"]}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* News Section > User Info */}
                        <div className="w-full h-[17%] px-4 pb-4 font-gambarino">
                            <div className="w-full h-full rounded-xl flex items-center gap-x-4 text-white overflow-hidden">
                                <div className="rounded-full border-2 border-white/40 flex items-center justify-center
                             
                                min-h-[45px] min-w-[45px]
                                lg:min-h-[50px] lg:min-w-[50px]
                                ">
                                    <img src={user} className="p-2 md:h-[40px] lg:h-[40px]" alt="" />
                                </div>
                                <div>
                                    <div className="text-xl">{readFullname}</div>
                                    <div className="font-excon text-[12px] text-stone-300">{readEmail}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat section */}
                    <div className="font-excon h-full bg-stone-500/20 rounded-2xl backdrop-blur-3xl text-white
                    w-full
                    md:w-[60%]
                    lg:w-[65%]
                    ">
                        {/* Chat Section */}
                        <div className="h-[91%] w-full p-2 text-sm">
                            <div
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                className="w-full h-full px-2 flex flex-col gap-y-3 overflow-y-auto"
                            >
                                {allMessages.length > 0 &&
                                    allMessages.map((msg, index) => {

                                        const isUser = msg.userId === userID

                                        return (
                                            <div
                                                key={index}
                                                className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}
                                            >
                                                {isUser ? (
                                                    <div className="flex flex-col items-end bg-stone-400/20 px-4 py-2 rounded-2xl max-w-[80%] md:max-w-[70%]">

                                                        <div className="text-white flex justify-center">
                                                            {msg.message}
                                                        </div>
                                                        <div className="text-[10px] text-gray-300/70 self-start">
                                                            <div>{msg.time}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-start bg-black/20 px-4 py-2 rounded-2xl max-w-[80%] md:max-w-[70%]">
                                                        <div className="text-[11px] text-gray-300/70">
                                                            <div>{msg.fullname}</div>
                                                        </div>
                                                        <div className="text-white flex justify-center">
                                                            {msg.message}
                                                        </div>
                                                        <div className="text-[10px] text-gray-300/70 self-end">
                                                            <div>{msg.time}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                <div ref={bottomRef} />
                            </div>
                        </div>


                        {/* Chat [TYPE] */}
                        <div className="h-[9%] w-full py-2 px-2 md:px-14 flex gap-x-2 items-center">
                            <input
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        sendMessageBody();
                                    }
                                }}
                                type="text"
                                placeholder="Type something . . ."
                                className="outline-none px-6 rounded-[25px] w-full h-full bg-black/20"
                                value={message}
                            />
                            <div
                                onClick={() => sendMessageBody()}
                                className="rounded-full bg-black/20 hover:bg-white/10 cursor-pointer flex items-center justify-center
                              
                                min-h-[42px] min-w-[42px]
                                lg:min-h-[44px] lg:min-w-[44px]">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="size-6 text-white">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default App