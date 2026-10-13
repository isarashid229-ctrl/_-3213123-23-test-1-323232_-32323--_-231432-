/* AI Quest — learning content. Edit this file to change lessons, quizzes and glossary. */
window.AIQ_DATA = (function () {
  const MODULES = [
    /* ------------------------------------------------------------------ */
    {
      id: 'foundations',
      title: 'AI Foundations',
      subtitle: 'What AI really is, and how it works',
      icon: '🧠',
      color: '#6c63ff',
      blurb: 'Peek inside the machine: learn what AI is, how computers learn from data, how chatbots predict words, and where AI goes wrong.',
      lessons: [
        {
          id: 'foundations-1',
          title: 'What Is Artificial Intelligence?',
          minutes: 6,
          body: `
            <p><strong>Artificial intelligence (AI)</strong> is a branch of computer science that builds systems able to do tasks that normally need human intelligence, such as recognizing faces, understanding speech, translating languages, making recommendations, or playing strategy games.</p>
            <h3>Rules vs. learning</h3>
            <p>Traditional software follows <em>rules a programmer wrote</em>: "if the temperature is below 68°F, turn on the heat." Most modern AI is different. Instead of being given every rule, it <em>learns patterns from examples</em>. Show a system thousands of labeled photos of cats and it works out for itself what "cat" looks like.</p>
            <h3>Narrow AI vs. general AI</h3>
            <ul>
              <li><strong>Narrow AI</strong> is great at one job (spam filtering, route planning, voice recognition). <em>Every AI you use today is narrow AI</em>, even the ones that seem very flexible.</li>
              <li><strong>Artificial general intelligence (AGI)</strong> would match human ability across almost any task. It is a research goal and does <em>not</em> exist yet.</li>
            </ul>
            <h3>A very short timeline</h3>
            <ol class="timeline">
              <li><b>1956</b> The term "artificial intelligence" is used at the Dartmouth summer workshop.</li>
              <li><b>1997</b> IBM's Deep Blue defeats world chess champion Garry Kasparov.</li>
              <li><b>2016</b> DeepMind's AlphaGo beats Go champion Lee Sedol.</li>
              <li><b>2022 →</b> Chatbots and image generators reach millions of everyday users.</li>
            </ol>
            <div class="callout"><b>Reality check:</b> AI is not magic and it is not a person. It is math applied to data, running on very fast computers.</div>`,
          takeaways: [
            'AI = computers doing tasks that usually need human intelligence.',
            'Modern AI learns patterns from data instead of following only hand-written rules.',
            'Today\'s AI is "narrow": strong at specific tasks, not generally intelligent.'
          ],
          activity: 'sortAI'
        },
        {
          id: 'foundations-2',
          title: 'How Machines Learn',
          minutes: 8,
          body: `
            <p><strong>Machine learning (ML)</strong> is the part of AI where a program improves at a task by studying data. Think of it like practicing free throws: every miss gives feedback, and your technique adjusts.</p>
            <h3>The three main ways to learn</h3>
            <ul>
              <li><strong>Supervised learning:</strong> learn from examples that already have the right answer (photos labeled "cat" or "dog").</li>
              <li><strong>Unsupervised learning:</strong> find hidden groups in data with no labels (grouping customers by shopping habits).</li>
              <li><strong>Reinforcement learning:</strong> learn by trial and error with rewards (a robot learning to walk, an AI learning a video game).</li>
            </ul>
            <h3>Neural networks in one minute</h3>
            <p>A <strong>neural network</strong> is made of many tiny calculators called <em>neurons</em>. Each neuron multiplies its inputs by <strong>weights</strong> (how important each input is), adds them up, and passes along a result. <strong>Training</strong> means nudging the weights, over and over, to shrink the model's mistakes (its <em>loss</em>).</p>
            <p>You'll train a one-neuron "umbrella predictor" yourself in the activity below. Real networks do the same thing with billions of weights.</p>
            <div class="callout"><b>Garbage in, garbage out.</b> A model is only as good as its training data. Too little, too narrow, or too biased, and the AI will be too.</div>`,
          takeaways: [
            'Machine learning finds patterns in data instead of using hand-coded rules.',
            'Training adjusts weights to reduce error (loss).',
            'Data quality decides model quality.'
          ],
          activity: 'neuron'
        },
        {
          id: 'foundations-3',
          title: 'How Chatbots Work',
          minutes: 7,
          body: `
            <p>Chatbots like the ones you may have used are built on <strong>large language models (LLMs)</strong>. An LLM is a neural network trained on an enormous amount of text to do one deceptively simple thing: <em>predict the next piece of text</em>.</p>
            <h3>Tokens and probabilities</h3>
            <p>Text is chopped into <strong>tokens</strong> (words or word-parts). Given the tokens so far, the model scores every possible next token. It picks one, adds it, and repeats, producing a sentence token by token.</p>
            <h3>Why answers differ every time</h3>
            <p>The model usually doesn't pick the single most likely token. A setting called <strong>temperature</strong> controls how adventurous it is: low = safe and predictable, high = creative and surprising.</p>
            <h3>What this means for you</h3>
            <ul>
              <li>An LLM generates <em>plausible-sounding</em> text. It does not "look up" facts in a database or know when it is wrong.</li>
              <li>It only sees what's in the conversation (its <strong>context window</strong>) plus patterns learned in training.</li>
              <li>After pre-training, developers further tune models using human feedback so they are more helpful and safer.</li>
            </ul>
            <div class="callout"><b>Mental model:</b> an LLM is a super-powered autocomplete, not a search engine and not a mind.</div>`,
          takeaways: [
            'LLMs are trained to predict the next token of text.',
            'Temperature controls randomness: low is predictable, high is creative.',
            'Fluent text is not the same as true text.'
          ],
          activity: 'nextWord'
        },
        {
          id: 'foundations-4',
          title: 'What AI Gets Wrong',
          minutes: 6,
          body: `
            <p>Knowing how AI fails makes you a much better user. Here are the big ones:</p>
            <ul>
              <li><strong>Hallucinations:</strong> the model confidently states things that are false, including invented quotes, statistics, sources, and links. It isn't lying; it is producing text that <em>fits the pattern</em>.</li>
              <li><strong>Bias:</strong> models learn from human-made data, so they can repeat stereotypes and unfair patterns found in it.</li>
              <li><strong>Outdated knowledge:</strong> a model knows only what existed up to its training cutoff, unless it is connected to search.</li>
              <li><strong>Shaky reasoning:</strong> multi-step math, logic puzzles, and counting can trip it up.</li>
              <li><strong>Overconfidence:</strong> wrong answers often sound exactly as sure as right ones.</li>
            </ul>
            <div class="callout warn"><b>The golden rule:</b> treat AI output as a <em>first draft from a smart but unreliable helper</em>, never as a final authority. Check anything that matters.</div>`,
          takeaways: [
            'AI can hallucinate: invented facts and fake citations are common.',
            'Confidence in the tone of an answer says nothing about its accuracy.',
            'Always verify important claims with reliable sources.'
          ],
          activity: 'hallucination'
        }
      ],
      quiz: [
        { q: 'Which best describes the AI systems we use today?', options: ['They think and feel like humans', 'Narrow AI that is strong at specific tasks', 'Artificial general intelligence', 'Simple if/then rule lists only'], answer: 1, explain: 'All current AI is narrow AI. AGI is still a research goal.' },
        { q: 'In machine learning, what is "training"?', options: ['Typing rules into the program', 'Adjusting weights to reduce mistakes on data', 'Plugging the computer into more power', 'Deleting wrong answers'], answer: 1, explain: 'Training repeatedly nudges the model\'s weights so its error (loss) shrinks.' },
        { q: 'At its core, what does a large language model do?', options: ['Searches the internet for facts', 'Predicts the next token of text', 'Stores every answer in a database', 'Understands meaning exactly like a person'], answer: 1, explain: 'LLMs generate text one token at a time by predicting what comes next.' },
        { q: 'A chatbot cites a study you can\'t find anywhere. What is the most likely explanation?', options: ['The study is too new to be online', 'The AI hallucinated a plausible-looking source', 'Your search engine is broken', 'It is definitely real'], answer: 1, explain: 'Invented citations are a classic hallucination. Always verify sources.' },
        { q: 'What does a HIGH temperature setting do?', options: ['Makes output more random and creative', 'Makes the computer run hotter', 'Guarantees correct answers', 'Makes answers identical every time'], answer: 0, explain: 'Higher temperature makes less-likely tokens more likely to be chosen.' }
      ]
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'tools',
      title: 'AI Tools & Techniques',
      subtitle: 'Use AI as a study partner, not a shortcut',
      icon: '🛠️',
      color: '#00bfa6',
      blurb: 'Tour the AI toolbox, master the art of prompting, build smart study routines, and learn how to double-check what AI tells you.',
      lessons: [
        {
          id: 'tools-1',
          title: 'The AI Toolbox',
          minutes: 6,
          body: `
            <p>"AI tool" covers a lot of ground. Knowing the <em>categories</em> helps you pick the right one for the job, even as specific products change.</p>
            <ul>
              <li><strong>Chat assistants</strong> explain, brainstorm, and answer questions in conversation.</li>
              <li><strong>Writing helpers</strong> check grammar, clarity, and tone in <em>your</em> writing.</li>
              <li><strong>Research tools</strong> search and summarize sources and, ideally, show you where info came from.</li>
              <li><strong>Image &amp; media generators</strong> create pictures, audio, or video from descriptions.</li>
              <li><strong>Coding &amp; math helpers</strong> explain code, find bugs, and show worked solutions.</li>
            </ul>
            <p>Open the explorer below to see what each type is good for, how it can be used in class, and the catch to watch for.</p>
            <div class="callout warn"><b>Before you use any tool:</b> check your school's and teacher's AI policy, and read the tool's age requirements and privacy settings. Many tools require users to be 13+ or 18+, or need a parent or school account.</div>`,
          takeaways: [
            'Different AI tool types suit different tasks.',
            'Every type has a limitation, so match the tool to the job.',
            'Check school policy and age rules before using a tool.'
          ],
          activity: 'toolTypes'
        },
        {
          id: 'tools-2',
          title: 'Prompt Crafting',
          minutes: 8,
          body: `
            <p>A <strong>prompt</strong> is the instruction you give an AI. Vague prompts get vague answers. Strong prompts include five ingredients, easy to remember as <strong>R-T-C-F-C</strong>:</p>
            <ol>
              <li><strong>Role:</strong> who should the AI act as? <em>"Act as a patient chemistry tutor."</em></li>
              <li><strong>Task:</strong> what exactly do you need? <em>"Explain how buffers resist pH change."</em></li>
              <li><strong>Context:</strong> who are you, what do you already know? <em>"I'm a 10th grader who understands acids and bases."</em></li>
              <li><strong>Format:</strong> how should the answer look? <em>"Use 3 bullet points and one analogy."</em></li>
              <li><strong>Constraints:</strong> limits or rules. <em>"Under 150 words. Don't use jargon."</em></li>
            </ol>
            <h3>Then iterate</h3>
            <p>Your first prompt is a draft. Follow up: "Make it simpler," "Give a different example," "What would a counter-argument be?" Conversation is the superpower.</p>
            <div class="callout"><b>Pro move:</b> tell the AI to <em>ask you questions first</em> if it needs more information. Try: "Before answering, ask me anything you need to know."</div>`,
          takeaways: [
            'Use Role, Task, Context, Format, Constraints.',
            'Specific prompts beat vague ones.',
            'Iterate with follow-up prompts instead of starting over.'
          ],
          activity: 'promptLab'
        },
        {
          id: 'tools-3',
          title: 'Your AI Study Coach',
          minutes: 7,
          body: `
            <p>The best academic uses of AI make <em>you</em> do more thinking, not less. Think of AI as a tutor who never gets tired, not as a ghostwriter.</p>
            <h3>Five study moves that actually help learning</h3>
            <ul>
              <li><strong>Explain it back:</strong> teach the concept to the AI, then ask it to find gaps.</li>
              <li><strong>Quiz me:</strong> generate practice questions and have it grade your answers.</li>
              <li><strong>Feedback on my draft:</strong> ask for suggestions on structure and clarity, then do the rewriting yourself.</li>
              <li><strong>Plan my time:</strong> turn a test date and topic list into a study schedule.</li>
              <li><strong>Translate jargon:</strong> have a dense paragraph explained at your level.</li>
            </ul>
            <p>Flip the cards below to see a ready-to-use prompt for each move.</p>
            <div class="callout"><b>The "who did the thinking?" test:</b> if you couldn't explain your final work out loud without the AI, it did too much of the thinking.</div>`,
          takeaways: [
            'Use AI to deepen understanding, not to skip it.',
            'Good uses: quizzing, feedback, explanations, planning.',
            'You should be able to explain your work without the AI.'
          ],
          activity: 'studyCards'
        },
        {
          id: 'tools-4',
          title: 'Verify, Then Trust',
          minutes: 6,
          body: `
            <p>Because AI can hallucinate, a quick verification habit is a core skill. Use the <strong>SIFT</strong> method, created by digital-literacy researcher Mike Caulfield for checking online information, and it works perfectly on AI answers:</p>
            <ol>
              <li><strong>S: Stop.</strong> Pause before you copy or share. Does the claim feel too perfect?</li>
              <li><strong>I: Investigate the source.</strong> Ask the AI for sources, then check that they really exist.</li>
              <li><strong>F: Find better coverage.</strong> Look for the claim in textbooks, encyclopedias, or news from reputable outlets.</li>
              <li><strong>T: Trace claims.</strong> Follow numbers and quotes back to their original study or document.</li>
            </ol>
            <p>For high-stakes work (health, law, citations, math), always confirm with a trusted source or your teacher.</p>
            <div class="callout"><b>Bonus trick:</b> ask a second time in a fresh chat or with a different tool. If the answers disagree, you've found something worth checking.</div>`,
          takeaways: [
            'SIFT: Stop, Investigate, Find better coverage, Trace claims.',
            'Never cite a source you have not opened yourself.',
            'Disagreement between answers is a signal to dig deeper.'
          ],
          activity: 'sift'
        }
      ],
      quiz: [
        { q: 'Which prompt is strongest?', options: ['"Help with history"', '"Act as a history tutor. I\'m in 10th grade. Explain the causes of WWI in 5 bullets, under 120 words."', '"Tell me everything about WWI"', '"history wwi"'], answer: 1, explain: 'It includes a role, context, task, format, and constraints.' },
        { q: 'What does the "C" in R-T-C-F-C stand for (first C)?', options: ['Copy', 'Context', 'Computer', 'Correct'], answer: 1, explain: 'Role, Task, Context, Format, Constraints.' },
        { q: 'Which is the best use of AI for studying?', options: ['Having it write your essay', 'Asking it to quiz you and grade your answers', 'Copying its answers on a take-home test', 'Letting it do all your problem sets'], answer: 1, explain: 'Quizzing keeps you doing the thinking and reveals what you don\'t know yet.' },
        { q: 'In SIFT, what does the "T" mean?', options: ['Trust the AI', 'Trace claims back to the original source', 'Type faster', 'Translate the answer'], answer: 1, explain: 'Trace claims, quotes, and numbers back to where they came from.' },
        { q: 'An AI gives you a citation. What should you do before using it?', options: ['Use it because it sounds official', 'Find and open the real source to confirm it exists and says that', 'Ask the AI if it is sure', 'Change the year'], answer: 1, explain: 'AI often invents sources, and asking it "are you sure?" does not verify anything.' }
      ]
    },
    /* ------------------------------------------------------------------ */
    {
      id: 'ethics',
      title: 'Ethical AI Use',
      subtitle: 'Be honest, fair, safe, and smart',
      icon: '🛡️',
      color: '#ff7a59',
      blurb: 'Use AI with integrity: know the line on academic honesty, spot bias, protect your privacy, and give credit where it is due.',
      lessons: [
        {
          id: 'ethics-1',
          title: 'Academic Integrity',
          minutes: 6,
          body: `
            <p>School is about building <em>your</em> skills. Academic integrity means the work you submit shows what <em>you</em> know and can do, and that you're honest about any help you received.</p>
            <h3>A traffic-light guide</h3>
            <ul class="lights">
              <li class="green"><b>Green: usually fine.</b> Asking for explanations, practice quizzes, brainstorming ideas, or study plans.</li>
              <li class="yellow"><b>Yellow: ask first.</b> Grammar and style edits on your own draft, outlining, or code debugging. It depends on the assignment and the teacher.</li>
              <li class="red"><b>Red: not okay.</b> Submitting AI-written work as your own, using AI on a test or on assignments where it is banned, or inventing sources.</li>
            </ul>
            <h3>Three habits</h3>
            <ol>
              <li><strong>Read the policy</strong> for each class. Rules differ between teachers and assignments.</li>
              <li><strong>Disclose</strong> when you used AI and how.</li>
              <li><strong>When unsure, ask</strong> before you submit, not after.</li>
            </ol>
            <div class="callout warn"><b>Remember:</b> teachers and detection tools are not perfect, but integrity isn't about getting caught. It's about whether you actually learned.</div>`,
          takeaways: [
            'Your submitted work should reflect your own learning.',
            'Policies differ, so read them and ask when unsure.',
            'Disclose AI help honestly.'
          ],
          activity: 'integrity'
        },
        {
          id: 'ethics-2',
          title: 'Bias & Fairness',
          minutes: 7,
          body: `
            <p>AI isn't automatically objective. It learns from data created by people, so it can absorb and even amplify human biases.</p>
            <h3>Where bias sneaks in</h3>
            <ul>
              <li><strong>Unbalanced data:</strong> if a face-recognition system is trained mostly on one group, it performs worse on others.</li>
              <li><strong>Historical bias:</strong> a hiring AI trained on past hires copies past unfair choices.</li>
              <li><strong>Labeling and design choices:</strong> people decide what to measure and what counts as "success."</li>
            </ul>
            <h3>Why it matters</h3>
            <p>AI now helps decide who sees which ads, which job applicants get interviews, and how some risks are scored. Unfair systems can quietly affect real people's opportunities.</p>
            <h3>What you can do</h3>
            <ul>
              <li>Ask: <em>Who is in the data? Who is missing?</em></li>
              <li>Test AI answers with different names, genders, or backgrounds, and compare.</li>
              <li>Remember a human should stay responsible for important decisions.</li>
            </ul>`,
          takeaways: [
            'AI inherits bias from its data and design choices.',
            'Balanced, representative data improves fairness.',
            'Humans must stay accountable for high-impact decisions.'
          ],
          activity: 'bias'
        },
        {
          id: 'ethics-3',
          title: 'Privacy & Your Data',
          minutes: 6,
          body: `
            <p>When you type into an AI tool, you're sending data to a company's servers. Depending on the service and your settings, conversations may be stored, reviewed for safety, or used to improve models.</p>
            <h3>Never paste these into a chatbot</h3>
            <ul>
              <li>Full names, home address, phone number, personal email</li>
              <li>Student ID numbers, passwords, or account details</li>
              <li>Private photos or other people's personal information</li>
              <li>Anything a teacher or school told you is confidential</li>
            </ul>
            <h3>Smart privacy habits</h3>
            <ol>
              <li><strong>Redact:</strong> swap real details for placeholders like [NAME] or [SCHOOL].</li>
              <li><strong>Check settings:</strong> look for options to turn off chat history or training use.</li>
              <li><strong>Think of a screenshot rule:</strong> if you wouldn't post it publicly, don't paste it.</li>
            </ol>
            <div class="callout"><b>Respect others too.</b> Don't upload classmates' photos or messages to AI tools without their permission.</div>`,
          takeaways: [
            'What you type may be stored and reviewed.',
            'Redact personal details before using AI.',
            'Protect other people\'s privacy as well as your own.'
          ],
          activity: 'privacy'
        },
        {
          id: 'ethics-4',
          title: 'Truth, Deepfakes & Giving Credit',
          minutes: 7,
          body: `
            <h3>Synthetic media</h3>
            <p>AI can now create realistic images, voices, and videos. A <strong>deepfake</strong> is synthetic media that makes someone appear to say or do something they never did. They can be used for fun or art, but also for scams, harassment, and misinformation. Creating deceptive or humiliating fakes of real people can hurt them and may break school rules or the law.</p>
            <p><strong>Spot-check habits:</strong> look for odd hands, lighting, or blurred edges; check who posted it; search for the same story from trusted outlets.</p>
            <h3>Give credit</h3>
            <p>AI output may echo its training data, and the legal and ethical status of AI-generated work is still being decided. A good rule: <strong>if AI helped, say so, and cite it</strong> the way your teacher asks (APA, MLA, or a simple disclosure statement).</p>
            <h3>The bigger picture</h3>
            <p>Training and running large AI systems takes real energy and resources. Use AI when it truly helps rather than for every tiny task.</p>
            <div class="callout"><b>Your pledge:</b> I will use AI honestly, protect privacy, check facts, treat people fairly, and give credit.</div>`,
          takeaways: [
            'Deepfakes can deceive and harm, so verify before sharing.',
            'Disclose and cite AI assistance.',
            'Use AI thoughtfully, with its costs in mind.'
          ],
          activity: 'cite'
        }
      ],
      quiz: [
        { q: 'You used AI to brainstorm essay topics. What is the best next step?', options: ['Say nothing', 'Follow your teacher\'s policy and disclose the help', 'Delete your chat history only', 'Submit the AI\'s essay instead'], answer: 1, explain: 'Disclose AI help according to the assignment rules.' },
        { q: 'Why can an AI hiring tool be unfair?', options: ['Computers always prefer men', 'It may learn from historical data that contains human bias', 'It gets tired', 'It cannot read resumes'], answer: 1, explain: 'Models learn patterns from data, including unfair ones.' },
        { q: 'Which is safe to paste into a public chatbot?', options: ['Your home address', 'Your student ID', 'A general question about photosynthesis', 'Your phone number'], answer: 2, explain: 'General questions contain no personal data.' },
        { q: 'What is a deepfake?', options: ['A very deep neural network', 'Synthetic media that falsely shows someone saying or doing something', 'A type of encryption', 'A fast computer'], answer: 1, explain: 'Deepfakes are AI-generated fakes of real people\'s likeness or voice.' },
        { q: 'When is it okay to use AI on a graded assignment?', options: ['Always', 'Never in any class', 'When your teacher\'s policy allows it and you follow the rules', 'Only if no one finds out'], answer: 2, explain: 'Follow your teacher\'s policy and ask if you are unsure.' }
      ]
    }
  ];

  const GLOSSARY = [
    ['Algorithm', 'A step-by-step set of instructions a computer follows to solve a problem.'],
    ['Artificial General Intelligence (AGI)', 'A hypothetical AI that could learn and perform almost any intellectual task a human can. It does not exist yet.'],
    ['Artificial Intelligence (AI)', 'Computer systems that perform tasks normally requiring human intelligence, such as perception, language, and decision-making.'],
    ['Bias (in AI)', 'Systematic unfairness in an AI system\'s results, often inherited from unbalanced or prejudiced training data.'],
    ['Chatbot', 'A program you converse with in natural language. Modern ones are powered by large language models.'],
    ['Context window', 'The amount of text a language model can consider at one time, including your conversation so far.'],
    ['Deepfake', 'AI-generated or AI-altered image, audio, or video that falsely depicts a real person.'],
    ['Generative AI', 'AI that creates new content (text, images, audio, code) rather than only analyzing existing data.'],
    ['Hallucination', 'When an AI produces false or made-up information that sounds believable.'],
    ['Large Language Model (LLM)', 'A neural network trained on vast amounts of text to predict and generate language.'],
    ['Loss', 'A number measuring how wrong a model\'s predictions are. Training tries to make it smaller.'],
    ['Machine Learning (ML)', 'A way of building AI where a system learns patterns from data instead of following only hand-written rules.'],
    ['Model', 'The trained mathematical system that takes input and produces output, such as a prediction or a piece of text.'],
    ['Narrow AI', 'AI designed for a specific task. All AI in use today is narrow AI.'],
    ['Neural Network', 'A computing system of connected "neurons" with adjustable weights, loosely inspired by the brain.'],
    ['Prompt', 'The instruction or question you give to an AI system.'],
    ['Prompt Engineering', 'Writing and refining prompts to get better, more useful AI responses.'],
    ['Reinforcement Learning', 'Learning by trial and error, guided by rewards and penalties.'],
    ['SIFT', 'A fact-checking method: Stop, Investigate the source, Find better coverage, Trace claims.'],
    ['Supervised Learning', 'Training on examples that come with the correct answers (labels).'],
    ['Temperature', 'A setting controlling how random or creative a language model\'s output is.'],
    ['Token', 'A small piece of text (a word or part of a word) that language models read and generate.'],
    ['Training Data', 'The examples a model learns from. Its quality, size, and balance shape how good and how fair the model is.'],
    ['Unsupervised Learning', 'Finding patterns or groups in data without labeled answers.'],
    ['Weights', 'Numbers inside a neural network that determine how strongly each input affects the output. Training adjusts them.']
  ];

  return { MODULES, GLOSSARY };
})();
