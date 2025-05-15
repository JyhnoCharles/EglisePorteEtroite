
// Connect to adminLogin.html
// 
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// our databa base information
const SUPABASE_URL = import.meta.env.SUPABASE_URL || 'https://bpuvpllpfwfqgirbxbup.supabase.co';
const SUPABASE_KEY = import.meta.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwdXZwbGxwZndmcWdpcmJ4YnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwOTcxMDYsImV4cCI6MjA2MjY3MzEwNn0.wYnCtBZW8qqKOknXFbDk2HkSQt12nMxM2EmhkTBKbps';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// grabs data from login
const form = document.getElementById('loginform');

// Listen to when the submit button is pressed to send information
form.addEventListener('submit', async(e) => {
    e.preventDefault(); // test this later

    const username     = e.target.username.value;
    const password     = e.target.password.value;

    try{

        //Checks and  Verifies login information
        const { error } = await supabase.auth.signInWithPassword({ username, password});

        if (error) throw error; // worng password or user does not exist

        window.location = '/admindashboard.html';

        

    } catch (err){
            alert('login failed:' + err.message);
        }
});

