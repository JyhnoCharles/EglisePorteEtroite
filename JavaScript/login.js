
// Connect to adminLogin.html
// 
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

//
const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.SUPABASE_ANON_KEY;


const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// grabs data from login
const form = document.getElementById('loginform');

// Listen to when the submit button is pressed to send information
form.addEventListener('submit', async(e) => {
    e.preventDefault(); // test this later

    const email        = e.target.email.value;
    const password     = e.target.password.value;

    try{

        //Checks and  Verifies login information
        const { error } = await supabase.auth.signInWithPassword({ email, password});

        if (error) throw error; // worng password or user does not exist

        window.location = '/admindashboard.html';

        

    } catch (err){
            alert('login failed:' + err.message);
        }
});

