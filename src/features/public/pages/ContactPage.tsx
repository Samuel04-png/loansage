import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent } from '../../../components/ui/card';
import { ShieldAlert, Mail, Phone, MapPin, Send, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactFormData = z.infer<typeof contactSchema>;

export function ContactPage() {
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const onSubmit = async (data: ContactFormData) => {
    setLoading(true);
    // In a real app, this would send to a backend API
    setTimeout(() => {
      toast.success('Message sent! We\'ll get back to you soon.');
      reset();
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">LoanSage</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
                Home
              </Link>
              <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900">
                About
              </Link>
              <Link to="/auth/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold text-slate-900 mb-6"
          >
            Get in Touch
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-slate-600"
          >
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </motion.p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Send us a message</h2>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" {...register('name')} />
                    {errors.name && (
                      <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" {...register('email')} />
                    {errors.email && (
                      <p className="text-sm text-destructive mt-1">{errors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input id="subject" {...register('subject')} />
                    {errors.subject && (
                      <p className="text-sm text-destructive mt-1">{errors.subject.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <textarea
                      id="message"
                      className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      {...register('message')}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive mt-1">{errors.message.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Mail className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Email</h3>
                      <p className="text-slate-600">support@loansage.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <Phone className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Phone</h3>
                      <p className="text-slate-600">+260 97 123 4567</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Address</h3>
                      <p className="text-slate-600">
                        123 Business Street<br />
                        Lusaka, Zambia
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Card className="bg-gradient-to-br from-primary-50 to-primary-100 border-primary-200">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-slate-900 mb-2">Business Hours</h3>
                  <p className="text-slate-700 text-sm">
                    Monday - Friday: 8:00 AM - 5:00 PM<br />
                    Saturday: 9:00 AM - 1:00 PM<br />
                    Sunday: Closed
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

